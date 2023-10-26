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

def isDrivePresent(serialNumber : str):
    filesSaved = os.listdir("./outputs")
    for fileName in filesSaved:
        try:
            with open("./outputs/" + fileName, "r") as fd:
                data = json.load(fd)
                if(serialNumber == data["Identify"]["Serial number"]):
                    return True
        except:
            print("Error while reading file " + fileName + ", skipping")
    return False

def saveJSON(clientJSON):
    count = len(os.listdir("./outputs"))
    with open("./outputs/drive" + str(count) + ".json", "x") as fd:
        json.dump(obj=clientJSON, fp=fd, ensure_ascii=False, indent=4)


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
    for file in savedFiles:
        returnString += file + ","
    returnString = returnString[:-1] # remove last ,
    return returnString

@post('/')
def receiveUpdate():
    clientJSON = request.json
    if(isDrivePresent(clientJSON["Identify"]["Serial number"])):
        response.status = 202
    else:
        try:
            saveJSON(clientJSON)
        except:
            print("Failed to save given JSON")
            response.status = 400
    return response
        
run(host='localhost', port=8000, debug=True)