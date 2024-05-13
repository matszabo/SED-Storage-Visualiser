# SPDX-License-Identifier: BSD-3-Clause

from flask import Flask, request, send_from_directory, render_template, make_response, session
from datetime import timedelta
from dotenv import load_dotenv
import bcrypt, os, json, shutil, re

app = Flask(__name__)

absRootPath = os.path.dirname(os.path.abspath(__file__))

app.permanent_session_lifetime = timedelta(hours=8)

load_dotenv("./.env")

app.secret_key = os.environ.get("SECRET_KEY")
admin_name = os.environ.get("ADMIN_NAME")
pwd = os.environ.get("PASSWORD").encode('utf-8')

# https://flask.palletsprojects.com/en/3.0.x/web-security/
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
)


def isDrivePresent(serialNumber: str, firmwareVersion: str):
    filesSaved = os.listdir("./Public/Outputs")
    for fileName in filesSaved:
        try:
            with open("./Public/Outputs/" + fileName, "r") as fd:
                data = json.load(fd)
                if(serialNumber == data["Identify"]["Serial number"] and firmwareVersion == data["Identify"]["Firmware version"]):
                    return True
        except:
            print(f"Error while reading file {fileName}, skipping")
    return False

def saveDrive(clientJSON):
    count = len(os.listdir("./Public/Outputs"))
    lastFile = sorted(os.listdir("./Public/Outputs"))[count - 1]
    newIndex = int(re.search('(\d+)\.json', lastFile).group(1)) + 1
    with open(f"./Public/Outputs/drive{newIndex}.json", "x") as fd:
        json.dump(obj=clientJSON, fp=fd, ensure_ascii=True, indent=4)

def saveMetadata(clientJSON : object):
    if(not(f"drive{clientJSON['index']}.json" in os.listdir("./Public/Metadata"))):
        with open(f"./Public/Metadata/drive{clientJSON['index']}.json", "x") as fd:
            pass
    data = {}
    with open(f"./Public/Metadata/drive{clientJSON['index']}.json", "r+") as fd:
        # Strore read data and clear the file so that we can overwrite it
        if(len(fd.readlines()) == 0):
            mdIndex = "0"
            json.dump(obj={mdIndex : clientJSON["metadata"]}, fp=fd, ensure_ascii=True, indent=4)
            return mdIndex
        else:
            shutil.copy(f"./Public/Metadata/drive{clientJSON['index']}.json", f"./Public/Metadata/drive{clientJSON['index']}.tmp")
            try:
                fd.seek(0) # to account for the readlines()
                data = json.load(fd)
                fd.seek(0)
                # if metadata were removed to the point of only brackets remaining
                if(not(data == {})):
                    # create a temporary file in case of error
                    fd.truncate(0)
                    # convert string keys to int
                    indexes = [int(k) for k in data]
                    mdIndex = max(indexes) + 1
                    mdIndex = f"{mdIndex}"
                    data[mdIndex] = clientJSON["metadata"]
                    json.dump(obj=data, fp=fd, ensure_ascii=True, indent=4)
                    os.remove(f"./Public/Metadata/drive{clientJSON['index']}.tmp")
                    return mdIndex
                else:
                    fd.truncate(0)
                    mdIndex = "0"
                    json.dump(obj={mdIndex : clientJSON["metadata"]}, fp=fd, ensure_ascii=True, indent=4)
                    os.remove(f"./Public/Metadata/drive{clientJSON['index']}.tmp")
                    return mdIndex
            except Exception as error:
                print(error)
                os.remove(f"./Public/Metadata/drive{clientJSON['index']}.json")
                shutil.copy(f"./Public/Metadata/drive{clientJSON['index']}.tmp", f"./Public/Metadata/drive{clientJSON['index']}.json")
                os.remove(f"./Public/Metadata/drive{clientJSON['index']}.tmp")
            

def removeMetadata(index, mdIndex):
    if(f"drive{index}.json" in os.listdir("./Public/Metadata")):
        data = {}
        with open(f"./Public/Metadata/drive{index}.json", "r+") as fd:
            # Strore read data and clear the file so that we can overwrite it
            data = json.load(fd)
            if(not mdIndex in data):
                print(f"Metadata with index {mdIndex} not found")
                return
            fd.truncate(0)
        with open(f"./Public/Metadata/drive{index}.json", "r+") as fd:
            del data[mdIndex]
            json.dump(obj=data, fp=fd, ensure_ascii=True, indent=4)
    else:
        # File doesn't exist
        pass
        print("File to be removed doesn't exist")

def saveSSC(SSC):
    if(f"{SSC['SSC name']}.json" in os.listdir("./Public/SSCs")):
        print(f"{SSC['SSC name']} already exists in SSCs folder")
    else:
        with open(f"./Public/SSCs/{SSC['SSC name']}.json", "x") as fd:
            json.dump(obj=SSC, fp=fd, ensure_ascii=True, indent=4)

def removeDrive(index):
    try:
        os.remove(f"{absRootPath}/Public/Outputs/drive{index}.json")
        return True
    except OSError as error:
        print(error)
        return False
    
def isAuthorized():
    if('user' in session):
        return True
    else:
        return False
    
def isInt(object):
    try:
        int(object)
        return True
    except:
        return False


@app.after_request
def setHeaders(response):
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src https: 'unsafe-eval' 'unsafe-inline'; object-src 'none'"
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    return response

# Default routing of files
@app.get('/')
def defaultRoute():
    return send_from_directory("./Public/HTML/", "index.html")

@app.get('/<path:path>')
def returnFile(path):
    return send_from_directory("./Public/", path)

@app.get('/names')
def fetchFilenames():
    savedFiles = os.listdir("./Public/Outputs")
    returnJSON = {}
    for file in savedFiles:
        # Python returns timestamp seconds and float, so we need to convert it for JS
        returnJSON[file] = int(os.path.getmtime(f"./Public/Outputs/{file}")) * 1000
    return returnJSON

@app.get('/SSCs')
def fetchSSCs():
    savedFiles = os.listdir("./Public/SSCs")
    savedFiles = sorted(savedFiles)
    returnString = ""
    for file in savedFiles: # ",".join()
        returnString += file + ","
    returnString = returnString[:-1] # remove last ,
    return returnString

@app.delete('/SSCs')
def deleteSSC():
    if(isAuthorized()):
        filename = request.json["SSCfile"]
        savedFiles = os.listdir("./Public/SSCs")
        if(filename in savedFiles):
            os.remove(f"./Public/SSCs/{filename}")
            return '', 200
        else:
            return '', 400
    else:
        return '', 401

@app.post('/SSCs')
def receiveSSC():
    if(isAuthorized()):
        newSSC = request.json
        if(not("SSC" in newSSC and "SSC name" in newSSC and "SSC fset" in newSSC and
               "mandatory" in newSSC)):
            return 'JSON needs to contain SSC, SSC name, SSC fset and mandatory values', 400
        else:
            saveSSC(newSSC)
            return '', 200
    else:
        return '', 401

@app.post('/token')
def verifyToken():
    if(isAuthorized()):
        return '', 200
    else:
        return '', 401

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
            if(not isInt(clientJSON["index"])):
                return '', 400
            mdIndex = saveMetadata(clientJSON)
            return mdIndex, 202
        elif(action == "remMetadata"):
            if(not (isInt(clientJSON["index"]) and isInt(clientJSON["mdIndex"]))):
                return 'Invalid index or mdIndex', 400
            removeMetadata(clientJSON["index"], clientJSON["mdIndex"])
            print(f"Removed {clientJSON['mdIndex']} metadata from disk d{clientJSON['index']}")
            return '', 200
        
@app.post('/outputs')
def addDrive():
    if(not (isAuthorized())):
        return '', 401
    else:
        clientJSON = request.json
        if(isDrivePresent(clientJSON["Identify"]["Serial number"], clientJSON["Identify"]["Firmware version"])):
            return '', 202
        else:
            try:
                if(not("Identify" in clientJSON and "Discovery 0" in clientJSON)):
                    return 'Identify and Discovery 0 needed', 400
                saveDrive(clientJSON)
                return '', 200
            except Exception as error:
                print(error)
                print("Failed to save given JSON")
                return '', 400
            
@app.delete('/outputs')
def outputDelete():
    if(not (isAuthorized())):
        return '', 401
    else:
        clientJSON = request.json
        if(isInt(clientJSON["index"]) ):
            if(removeDrive(clientJSON["index"])):
                return '', 200
            else:
                return 'Failed to remove drive', 400
        else :
            return 'Provided drive index is not valid', 400
        
if __name__ == "__main__":
    app.run('0.0.0.0', port=8000)