// SPDX-License-Identifier: MIT

/**
 * Treat onupgradeneeded() here as error, because database should already be created by index.js
 */

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

var devInfo;
var db;

function getSelectedDev(){
    return new Promise((resolve, reject) => {

        const dbReq = indexedDB.open("storageDevs", 1);
    
        dbReq.onerror = ((event) => {
            alert("Failed to open internal indexedDB\n", event);
        })
    
        dbReq.onupgradeneeded = ((event) => {
            db = dbReq.result;
            const store = db.createObjectStore("drives", {keyPath : "index"});
            store.createIndex("indexCursor", ["index"], {unique : true});
        });
    
        dbReq.onsuccess = ((event) => {
            db = dbReq.result;
            let query = window.location.search;
            let params = new URLSearchParams(query);
            driveIndex = parseInt(params.get("dev"));
            
            const transaction = db.transaction("drives", "readonly");
            const store = transaction.objectStore("drives");
        
            const request = store.get(driveIndex);
            request.onsuccess = ((event) => {
                devInfo = request.result;
                resolve();
            });
            request.onerror = ((reason) => {
                console.error(`Failed to fetch drive with index ${driveIndex} from Indexeddb\n${reason}`);
                reject();
            });
        });
    });
}

// TODO change to table
function printSessionInfo(){
    let TPerElement = document.getElementById("SessionInfo");
    let SessionInfo = devInfo["driveInfo"]["Discovery 1"]["Properties"];
    if(typeof SessionInfo == "undefined"){
        TPerElement.innerHTML += "<p>Discovery 1 is missing</p>";
        return;
    }
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
    if(devInfo["OpalCompl"]["OpalMinorVerConflicts"].length > 0){
        let opalComplHTML = document.getElementById("OpalCompl");
        let output = "";
        devInfo["OpalCompl"]["OpalMinorVerConflicts"].forEach((clue, index) => {
            switch (clue) {
                case 0:
                    output += "<p>Interface control template found (.00 only feature)</p>";
                    break;
                case 1:
                    output += "<p>PSID authority found (>= .01 feature)</p>";
                    break;
                case 2:
                    output += "<p>Block SID Authentication feature found (>= .02 feature)</p>";
                    if(devInfo["OpalCompl"]["OpalMinorVerConflicts"].indexOf(1) == -1){
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
    for(key in devInfo["driveInfo"]["Identify"]){
        identification.innerHTML += `<p>${key}: ${devInfo["driveInfo"]["Identify"][key]}</p>`
    }
    printSessionInfo();
    if(("Opal SSC V2.00 Feature" in devInfo["driveInfo"]["Discovery 0"])){
        printOpalBreaches();
        checkOpalMinorVer();
    }
}

function printJSON(){
    let outputInfo = devInfo["driveInfo"];
    // This is done here again, because pre-formatting in index.js didn't work
    document.getElementById("JSONdump").innerHTML += JSON.stringify(outputInfo, null, 4);
}

getSelectedDev().then(() => {
    printDetails();
    printJSON();
});