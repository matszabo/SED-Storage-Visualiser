# SPDX-License-Identifier: MIT

""" TODO
    - trim serial numbers etc.?
    - add actual use of discovery tool
"""

import json
import requests

servName = "http://localhost:8000/"

# TODO send results to server
def sendJSON(jsonfile : dict):
    request = requests.post(url=servName, json=jsonfile)
    if(request.status_code == 201):
        print("Drive info stored successfully")
    elif (request.status_code == 202):
        print("Drive with given serial number is already stored on server")
    else:
        print("Unexpected return, status code:", request.status_code)

# TODO add parsing using tool, now just examples discovery0
def parseJSON():
    try:
        fd = open("./outputs/nvme1n1-discovery_all.json", "r")
    except:
        print("Failed to open file JSON with output")
        exit(1)
    data = json.load(fd)
    fd.close()
    return data

if __name__ == "__main__":
    data = parseJSON()
    sendJSON(data)