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
    devInfo = JSON.parse(localStorage.getItem(device));
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
        if(!(field in TPerManFields)){
            TPerElement.innerHTML += `<p>${field} : ${SessionInfo[field]}</p>`
        }
    }
}

function checkOpalMinorVer(){
    // Version conflicts were found
    if(devInfo["OpalMinorVerConflicts"].length > 0){
        let opalComplHTML = document.getElementById("OpalCompl");
        let output = "";
        devInfo["OpalMinorVerConflicts"].forEach((clue, index) => {
            switch (clue) {
                case 0:
                    output += "<p>Interface control template found (.00 only feature)</p>";
                    break;
                case 1:
                    output += "<p>PSID authority found (>= .01 feature)</p>";
                    break;
                case 2:
                    output += "<p>Block SID Authentication feature found (>= .02 feature)</p>";
                    if(devInfo["OpalMinorVerConflicts"].indexOf(1) == -1){
                        output += "<p>PSID authority missing (>= .01 feature)</p>";
                    }
                    break;
                default:
                    break;
            }
        });
        opalComplHTML.insertAdjacentHTML("afterend", `<h3>Opal minor version mismatches:</h3>${output}`);
    }
}

function printOpalBreaches(){
    let OpalHMTL = document.getElementById("OpalCompl");
    if(devInfo["OpalCompl"]["isCompliant"]){
        OpalHMTL.innerHTML += "<p>The device is compliant with Opal</p>";
    }
    else{
        OpalHMTL.innerHTML += "<p>The device isn't compliant with Opal for the following reasons:</p>";
        for(reason in devInfo["OpalCompl"]["complBreaches"]){
            OpalHMTL.innerHTML += `<p>${devInfo["OpalCompl"]["complBreaches"][reason]}</p>`;
        }
    }
}

function printDetails(){
    let identification = document.getElementById("devID");
    for(key in devInfo["Identify"]){
        identification.innerHTML += `<p>${key}: ${devInfo["Identify"][key]}</p>`
    }
    printSessionInfo();
    printOpalBreaches();
    checkOpalMinorVer();
}

function printJSON(){
    let outputInfo = devInfo;
    // Remove internal alias to present user with real output from tool
    delete outputInfo["alias"];
    delete outputInfo["OpalCompl"];
    delete outputInfo["OpalMinorVerConflicts"];
    delete outputInfo["dataRemMechs"];
    // This is done here again, because pre-formatting in index.js didn't work
    document.getElementById("JSONdump").innerHTML += JSON.stringify(outputInfo, null, 4);
}

getSelectedDev();
printDetails();
printJSON();