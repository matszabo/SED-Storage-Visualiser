// SPDX-License-Identifier: BSD-3-Clause

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
            const metadata = db.createObjectStore("metadata", {autoIncrement : true});
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

function printDataRemMech(){
    if(devInfo["dataRemMechs"].length > 0){
        let sessionHTML = document.getElementById("SessionInfo");
        let info = `<h2>Detected Data Removal Mechanisms</h2>\n`
        for(let mechanism of devInfo["dataRemMechs"]){
            info += `<p>${mechanism}</p>\n`
        }
        sessionHTML.insertAdjacentHTML("afterend", info);
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
    printDataRemMech();
}

function printJSON(){
    let outputInfo = devInfo["driveInfo"];
    delete outputInfo["Discovery 0"]["PSID feature"];
    // This is done here again, because pre-formatting in index.js didn't work
    document.getElementById("JSONdump").innerHTML += JSON.stringify(outputInfo, null, 4);
}

function saveToServer(mdJSON){  
    fetch(
        `${window.location.origin}/metadata`,
        {
            method : "POST", 
            headers: {"Content-Type": "application/json"},
            body : JSON.stringify({"index" : devInfo["index"], action : "addMetadata", "metadata" : mdJSON})
    }
    )
    // TODO add success check
}

function removeFromServer(mdIndex){
    fetch(
        `${window.location.origin}/metadata`,
        {
            method : "POST", 
            headers: {"Content-Type": "application/json"},
            body : JSON.stringify({"index" : devInfo["index"], action : "remMetadata", "mdIndex" : `${mdIndex}`})
    }
    )
}

function removeMetadata(mdIndex){
    let confirmation = confirm(`Are you sure you want to delete this metadata?`)
    if(confirmation){
        const transaction = db.transaction("metadata", "readwrite");
        const store = transaction.objectStore("metadata");

        const request = store.openCursor(devInfo["index"]);
        request.onsuccess = (event) => {
            let cursor = event.target.result;
            if(cursor){
                let entries = cursor.value;
                delete entries[mdIndex]
                cursor.update(entries);
                removeFromServer(mdIndex);
                printMetadata();
            }
        }
    }
}

function saveToStore(metadata, save){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("metadata", "readwrite");
        const store = transaction.objectStore("metadata");

        const request = store.openCursor(devInfo["index"]);
        request.onsuccess = (event) => {
            let cursor = event.target.result;
            if(cursor){
                let entries = cursor.value;
                let newIndex = (entries.length == 0) ? 0 : Math.max(...Object.keys(entries)) + 1;
                newIndex = `${parseInt(newIndex)}`
                if("mdIndex" in metadata){
                    if(metadata["mdIndex"] in entries){
                        console.log(`Rewriting metadata for ${metadata["mdIndex"]}`);
                    }
                    entries[metadata["mdIndex"]] = metadata;
                }
                else{
                    metadata["mdIndex"] = `${newIndex}`;
                    entries[`${newIndex}`] = metadata;
                }
                cursor.update(entries);
                if(save) saveToServer(metadata);
                resolve()
            }
            else{
                let addReq = store.add({"0" : metadata}, devInfo["index"]);
                addReq.onsuccess = () =>{
                    metadata["mdIndex"] = "0";
                    console.log(`Added metadata with index ${addReq.result} successfully`);
                    if(save) saveToServer(metadata);
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
            Object.entries(entries).forEach(([index, content]) => {
                mdHTML.innerHTML += `<button style="display: none;" class="authorized" id="remMDBut" onclick=removeMetadata(${index})>Remove</button>`
                if(content["notes"]) mdHTML.innerHTML += `<p>Notes: ${content["notes"]}</p>`
                if(content["url"]) mdHTML.innerHTML += `<a href="${content["url"]}">URL: ${content["url"]}</a>`
                if(content["filename"]){
                    mdHTML.innerHTML += `<p>Filename: ${content["filename"]}</p>`;
                    mdHTML.innerHTML += `<pre>Filename: ${content["content"]}</pre>`;
                }
            });
        }
    }
    request.onerror = (reason) => {
        console.error(`Failed to fetch metadata in printMetadata() for device d${devInfo["index"]}\n${reason}`);
    }
}

function saveMetadata(){
    return new Promise((resolve, reject) => {
        let inputFile = document.getElementById("mdFile");
        let note = document.getElementById("mdText").value;
        let urlContent = document.getElementById("mdUrl").value;
        if(inputFile.files.length > 0){
            let file = inputFile.files[0];
            let reader = new FileReader();
            reader.readAsText(file);
            reader.onload = () => {
                saveToStore({
                    notes : note,
                    url : urlContent,
                    filename : file.name,
                    content : reader.result
                }, true).then(() => {
                    // TODO save metadata to server
                    printMetadata();
                    resolve();
                })
            }
            reader.onerror = () => {
                console.error(`Failed to read uploaded file, reason:\n${reader.result}`);
                reject()
            }
        }
        else{
            saveToStore({
                notes : note,
                url : urlContent,
                filename : null,
                content : null
            }, true).then(() => {
                // TODO save metadata to server
                printMetadata();
                resolve();
            })
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
                            storePromises.push(saveToStore(metadata, false)) 
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
        checkAuthStatus();
    })
});