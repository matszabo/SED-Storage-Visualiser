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
            const metadata = db.createObjectStore("metadata");
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
    if("Discovery 1" in devInfo["driveInfo"]){
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
    else{
        TPerElement.innerHTML = `Discovery 1 is missing in the drive's source!`
    }
}

function checkOpalMinorVer(){
    // Version conflicts were found
    if(devInfo["SSCCompl"]["OpalMinorVerConflicts"].length > 0){
        let SSCComplHTML = document.getElementById("SSCCompl");
        let output = "";
        devInfo["SSCCompl"]["OpalMinorVerConflicts"].forEach((clue, index) => {
            switch (clue) {
                case 0:
                    output += "<p>Interface control template found (.00 only feature)</p>";
                    break;
                case 1:
                    output += "<p>PSID authority found (>= .01 feature)</p>";
                    break;
                case 2:
                    output += "<p>Block SID Authentication feature found (>= .02 feature)</p>";
                    if(devInfo["SSCCompl"]["OpalMinorVerConflicts"].indexOf(1) == -1){
                        output += "<p>PSID authority missing (>= .01 feature)</p>";
                    }
                    break;
                default:
                    break;
            }
        });
        SSCComplHTML.insertAdjacentHTML("afterend", `<h3>Opal minor version mismatches:</h3>${output}`);
    }
}

function printSSCBreaches(){
    let SSCHTML = document.getElementById("SSCCompl");
    if(devInfo["SSCCompl"]["isCompliant"]){
        SSCHTML.innerHTML += "<p>The device is compliant with its SSC</p>";
    }
    else{
        SSCHTML.innerHTML += "<p>The device isn't compliant with its SSC for the following reasons:</p>";
        for(reason in devInfo["SSCCompl"]["complBreaches"]){
            SSCHTML.innerHTML += `<p>${devInfo["SSCCompl"]["complBreaches"][reason]}</p>`;
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
        checkOpalMinorVer();
    }
    printSSCBreaches();
}

function printJSON(){
    let outputInfo = devInfo["driveInfo"];
    delete outputInfo["Discovery 0"]["PSID feature"];
    // This is done here again, because pre-formatting in index.js didn't work
    document.getElementById("JSONdump").innerHTML += JSON.stringify(outputInfo, null, 4);
}

function saveToServer(mdJSON){  
    fetch(
        window.location.origin,
        {
            method : "POST", 
            headers: {"Content-Type": "application/json"},
            body : JSON.stringify({"index" : devInfo["index"], action : "addMetadata", "metadata" : mdJSON})
    }
    )
    // TODO add success check
}

function removeFromServer(filename){
    fetch(
        window.location.origin,
        {
            method : "POST", 
            headers: {"Content-Type": "application/json"},
            body : JSON.stringify({"index" : devInfo["index"], action : "remMetadata", "filename" : filename})
    }
    )
}

function removeMetadata(filename){
    let confirmation = confirm(`Are you sure you want to delete ${filename} ?`)
    if(confirmation){
        const transaction = db.transaction("metadata", "readwrite");
        const store = transaction.objectStore("metadata");

        const request = store.openCursor(devInfo["index"]);
        request.onsuccess = (event) => {
            let cursor = event.target.result;
            if(cursor){
                let entries = cursor.value;
                delete entries[filename]
                cursor.update(entries);
                removeFromServer(filename);
                printMetadata();
            }
        }
    }
}

function saveToStore(filename, metadata, save){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("metadata", "readwrite");
        const store = transaction.objectStore("metadata");

        const request = store.openCursor(devInfo["index"]);
        request.onsuccess = (event) => {
            let cursor = event.target.result;
            if(cursor){
                let entries = cursor.value;
                if(filename in entries){
                    console.log(`Rewriting metadata for ${filename}`);
                }
                entries[filename] = metadata;
                cursor.update(entries);
                if(save) saveToServer({[filename] : metadata});
                resolve()
            }
            else{
                let addReq = store.add({[filename] : metadata}, devInfo["index"]);
                if(save) saveToServer({[filename] : metadata});
                addReq.onsuccess = () =>{
                    console.log(`Added metadata to ${filename} successfully`);
                    resolve();
                }
                addReq.onerror = (reason) => {
                    console.error(`Failed to add metadata for ${filename}\n${reason}`);
                    reject();
                }
            }
        }
        request.onerror = (reason) => {
            console.error(`Failed to store metadata in saveToStore() for device d${devInfo["index"]}\n${reason}`);
            reject();
        }
    });
}

function printMetadata(){
    let mdHTML = document.getElementById("metadataDiv")
    mdHTML.innerHTML = "";

    const transaction = db.transaction("metadata", "readwrite");
    const store = transaction.objectStore("metadata");

    const request = store.openCursor(devInfo["index"]);
    request.onsuccess = (event) => {
        let cursor = event.target.result;
        if(cursor){
            let entries = cursor.value;
            Object.entries(entries).forEach(([filename, content]) => {
                mdHTML.innerHTML += `<h3>${filename}</h3><button onclick=removeMetadata("${filename}")>Remove</button>`;
                mdHTML.innerHTML += `<pre>${content}</pre>`;
            });
        }
    }
    request.onerror = (reason) => {
        console.error(`Failed to fetch metadata in printMetadata() for device d${devInfo["index"]}\n${reason}`);
    }
}

function saveMetadata(input){
    return new Promise((resolve, reject) => {
        let file = input.files[0];

        let reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
            saveToStore(file.name, reader.result, true).then(() => {
                // TODO save metadata to server
                printMetadata();
                resolve();
            })
        } 
        
        reader.onerror = () => {
            console.error(`Failed to read uploaded file, reason:\n${reader.result}`);
            reject()
        }
    });
}

function fetchMetadata(){
    return new Promise((resolve, reject) => {
        // Here a try-catch blocked is used instead of a promise catch because fetch() rejects only due to a type error, not due to a 400
        try {
            fetch(`./metadata/drive${devInfo["index"]}.json`)
            .then((response) => {
                if(!response.ok){
                    resolve();
                }
                else{
                    response.json().then((data) => {
                        let storePromises = [];
                        Object.entries(data).forEach(([filename, metadata]) => {
                            storePromises.push(saveToStore(filename, metadata, false)) 
                        })
                        Promise.all(storePromises).then(() => {
                            resolve();
                        })
                    });
                }
            })
        } catch (error) {
            console.log(`No metadata fetched from server, browser message:\n${error}`);
            resolve();
        }
    });
}

getSelectedDev().then(() => {
    printDetails();
    printJSON();
    fetchMetadata().then(() => {
        printMetadata();
    })
});