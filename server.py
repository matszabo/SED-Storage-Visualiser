# SPDX-License-Identifier: MIT

""" TODO 
    - licence for Bottle?
    - add checks of signing
    - add logging?
"""

from bottle import run, static_file, get, post, request, response
import os
import json

absRootPath = os.path.dirname(os.path.abspath(__file__))

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
    #TODO Check if file already exists and then dump inside
    if(f"drive{clientJSON['index']}.json" in os.listdir("./metadata")):
        data = {}
        with open(f"./metadata/drive{clientJSON['index']}.json", "r+") as fd:
            # Strore read data and clear the file so that we can overwrite it
            data = json.load(fd)
            fd.truncate(0)
        with open(f"./metadata/drive{clientJSON['index']}.json", "r+") as fd:
            for item in clientJSON["metadata"]:
                data[item] = clientJSON["metadata"][item]
            json.dump(obj=data, fp=fd, ensure_ascii=False, indent=4)
    else:
        # File doesn't exist yet
        with open("./metadata/drive" + str(clientJSON["index"]) + ".json", "x") as fd:
            json.dump(obj=clientJSON["metadata"], fp=fd, ensure_ascii=False, indent=4)
            print("New metadata file for drive" + str(clientJSON["index"]) + " was created")


# Default routing of files
@get('/')
def defaultRoute():
    return static_file(filename="index.html", root=absRootPath)

@get('/<filepath:path>')
def returnFile(filepath):
    print(filepath)
    return static_file(filename=filepath, root=absRootPath)

@get('/names')
def fetchFilenames():
    savedFiles = os.listdir("./outputs")
    returnString = ""
    for file in savedFiles: # ",".join()
        returnString += file + ","
    returnString = returnString[:-1] # remove last ,
    return returnString

@get('/SSCs')
def fetchSSCs():
    savedFiles = os.listdir("./SSCs")
    returnString = ""
    for file in savedFiles: # ",".join()
        returnString += file + ","
    returnString = returnString[:-1] # remove last ,
    return returnString

@post('/')
def receiveUpdate():
    clientJSON = request.json
    action = clientJSON["action"]
    if(action == "metadata"):
        saveMetadata(clientJSON)
        response.status = 202
    elif(action == "disk"):
        if(isDrivePresent(clientJSON["Identify"]["Serial number"], clientJSON["Identify"]["Firmware version"])):
            response.status = 202
        else:
            try:
                saveJSON(clientJSON)
            except:
                print("Failed to save given JSON")
                response.status = 400
    else:
        response.status = 400
   
    return response
        
run(host='localhost', port=8000, debug=True)