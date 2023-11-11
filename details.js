// SPDX-License-Identifier: MIT

// Mandatory Discovery fields, indicated values are required minimums, there are no maximums
const TPerManFields = {
    "MaxMethods" : 1,
    "MaxSubpackets" : 1,
    "MaxPacketSize" : 2028,
    "MaxPackets" : 1,
    "MaxComPacketSize" : 2048,
    "MaxResponseComPacketSize" : 2048,
    "MaxSessions" : 1,
    "MaxIndTokenSize" : 1992,
    "MaxAuthentications" : 2,
    "MaxTransactionLimit" : 1,
    "DefSessionTimeout" : 0
}

var device = "";
var devInfo;

function getSelectedDev(){
    let query = window.location.search;
    let params = new URLSearchParams(query);
    device = params.get("dev");
}

// TODO change to table
function printSessionInfo(){
    let TPerElement = document.getElementById("SessionInfo");
    let SessionInfo = devInfo["Discovery 1"]["Properties"];
    // Discovery 1 check compliance
    for(field in TPerManFields){
        if(!field in SessionInfo){
            TPerElement.innerHTML += `<p class="redBg">${field} : MISSING</p>`;
        }
        else{
            if(parseInt(SessionInfo[field] < parseInt(TPerManFields[field]))){
                TPerElement.innerHTML += `<p class="redBg"">${field} : ${SessionInfo[field]} (Required minimum: ${TPerManFields[field]})</p>`;
            }
            TPerElement.innerHTML += `<p">${field} : ${SessionInfo[field]}</p>`;
        }
    }
    TPerElement.innerHTML += `<h3>Optional fields</h3><div id="TPerOptional"></div>`;
    // Check for additional fields
    TPerElement = document.getElementById("TPerOptional");
    for(field in SessionInfo){
        console.log(field);
        if(!(field in TPerManFields)){
            TPerElement.innerHTML += `<p>${field} : ${SessionInfo[field]}</p>`
        }
    }
}

function printDetails(){
    devInfo = JSON.parse(localStorage.getItem(device));
    let identification = document.getElementById("devID");
    for(key in devInfo["Identify"]){
        identification.innerHTML += `<p>${key}: ${devInfo["Identify"][key]}</p>`
    }
    printSessionInfo();
}

function printJSON(){
    let outputInfo = devInfo;
    // Remove internal alias to present user with real output from tool
    delete outputInfo["alias"];
    // This is done here again, because pre-formatting in index.js didn't work
    document.getElementById("JSONdump").innerHTML += JSON.stringify(outputInfo, null, 4);
}

getSelectedDev();
printDetails();
printJSON();