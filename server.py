# SPDX-License-Identifier: BSD-3-Clause

""" TODO 
    - add checks of signing
    - add logging?
"""

from flask import Flask, request, send_from_directory, render_template, make_response, session
from datetime import timedelta
from dotenv import load_dotenv
import bcrypt
import os
import json

app = Flask(__name__)

absRootPath = os.path.dirname(os.path.abspath(__file__))

load_dotenv(f"{absRootPath}.env")

app.secret_key = os.environ.get("SECRET_KEY")
admin_name = os.environ.get("ADMIN_NAME")
salt = os.environ.get("SALT").encode('utf-8')
pwd = os.environ.get("PASSWORD").encode('utf-8')

def isDrivePresent(serialNumber: str, firmwareVersion: str):
    filesSaved = os.listdir("./outputs")
    for fileName in filesSaved:
        try:
            with open("./outputs/" + fileName, "r") as fd:
                data = json.load(fd)
                if(serialNumber == data["Identify"]["Serial number"] and firmwareVersion == data["Identify"]["Firmware version"]):
                    return True
        except:
            print(f"Error while reading file {fileName}, skipping")
    return False

def saveJSON(clientJSON):
    count = len(os.listdir("./outputs"))
    with open("./outputs/drive" + str(count) + ".json", "x") as fd:
        json.dump(obj=clientJSON, fp=fd, ensure_ascii=False, indent=4)

def saveMetadata(clientJSON : object):
    if(not(f"drive{clientJSON['index']}.json" in os.listdir("./metadata"))):
        with open(f"./metadata/drive{clientJSON['index']}.json", "x") as fd:
            pass
    data = {}
    with open(f"./metadata/drive{clientJSON['index']}.json", "r+") as fd:
        # Strore read data and clear the file so that we can overwrite it
        if(len(fd.readlines()) == 0):
            mdIndex = "0"
        else:
            fd.seek(0) # to account for the readlines()
            data = json.load(fd)
            # if metadata were removed to the point of only brackets remaining
            if(not(data == {})):
                fd.truncate(0)
                # convert string keys to int
                indexes = [int(k) for k in data]
                mdIndex = max(indexes) + 1
                mdIndex = f"{mdIndex}"
            return mdIndex            
    with open(f"./metadata/drive{clientJSON['index']}.json", "r+") as fd:
        data[mdIndex] = clientJSON["metadata"]
        json.dump(obj=data, fp=fd, ensure_ascii=False, indent=4)
        return mdIndex

def removeMetadata(index, mdIndex):
    if(f"drive{index}.json" in os.listdir("./metadata")):
        data = {}
        with open(f"./metadata/drive{index}.json", "r+") as fd:
            # Strore read data and clear the file so that we can overwrite it
            data = json.load(fd)
            if(not mdIndex in data):
                print(f"Metadata with index {mdIndex} not found")
                return
            fd.truncate(0)
        with open(f"./metadata/drive{index}.json", "r+") as fd:
            del data[mdIndex]
            json.dump(obj=data, fp=fd, ensure_ascii=False, indent=4)
    else:
        # File doesn't exist
        pass
        print("File to be removed doesn't exist")

def isAuthorized():
    if('user' in session):
        return True
    else:
        return False


# Default routing of files
@app.get('/')
def defaultRoute():
    return send_from_directory("./", "index.html")

@app.get('/<path:path>')
def returnFile(path):
    return send_from_directory("./", path)

@app.get('/names')
def fetchFilenames():
    savedFiles = os.listdir("./outputs")
    returnString = ""
    for file in savedFiles: # ",".join()
        returnString += file + ","
    returnString = returnString[:-1] # remove last ,
    return returnString

@app.get('/SSCs')
def fetchSSCs():
    savedFiles = os.listdir("./SSCs")
    returnString = ""
    for file in savedFiles: # ",".join()
        returnString += file + ","
    returnString = returnString[:-1] # remove last ,
    return returnString

@app.post('/login')
def login():
    auth = request.authorization
    if not auth:
        return '', 401
    else:
        username = auth.username
        password = auth.password.encode('utf-8')
        if((username == admin_name) and (bcrypt.checkpw(password, pwd))):
            session['user'] = auth.username
            session.permanent = True
            app.permanent_session_lifetime = timedelta(hours=8)
            return '', 200
        else:
            return '', 401
        
@app.post('/logout')
def logout():
    session.pop('user', None)
    return '', 200

@app.post('/metadata')
def metadataActions():
    if(not (isAuthorized())):
            return '', 401
    else:
        clientJSON = request.json
        action = clientJSON["action"]
        if(action == "addMetadata"):
            mdIndex = saveMetadata(clientJSON)
            return mdIndex, 202
        elif(action == "remMetadata"):
            removeMetadata(clientJSON["index"], clientJSON["mdIndex"])
            print(f"Removed {clientJSON['mdIndex']} metadata from disk d{clientJSON['index']}")
            return '', 200
        
@app.post('/outputs')
def outputAction():
    if(not (isAuthorized())):
        return '', 401
    else:
        clientJSON = request.json
        action = clientJSON["action"]
        if(action == "disk"):
            if(isDrivePresent(clientJSON["Identify"]["Serial number"], clientJSON["Identify"]["Firmware version"])):
                return '', 202
            else:
                try:
                    saveJSON(clientJSON)
                    return '', 200
                except:
                    print("Failed to save given JSON")
                    return '', 400
        else:
            return '', 400