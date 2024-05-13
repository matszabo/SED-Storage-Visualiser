// SPDX-License-Identifier: BSD-3-Clause


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
                if(parseInt(SessionInfo[field]) < parseInt(TPerManFields[field]) & parseInt(SessionInfo[field]) != 0){
                    TPerElement.innerHTML += `<p class="redBg" title="Required minimum: ${TPerManFields[field]}"><b>${field}</b> : ${SessionInfo[field]}</p>`;
                }
                else if(parseInt(SessionInfo[field]) > parseInt(TPerManFields[field]) || parseInt(SessionInfo[field]) == 0) {
                    TPerElement.innerHTML += `<p class="grBg" title="Better than required minimum: ${TPerManFields[field]}"><b>${field}</b> : ${SessionInfo[field]}</p> `;
                }
                else {
                    TPerElement.innerHTML += `<p><b>${field}</b> : ${SessionInfo[field]}</p>`;
                }    
            }
        }
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

function printDataRemMech(){
    if(devInfo["dataRemMechs"].length > 0) {
        document.getElementById("dataRemContainer").style.display = "block"
        let HTML = document.getElementById("dataRemInfo");
        let info = ""
        for(let mechanism of devInfo["dataRemMechs"]){
            info += `<p>${mechanism}</p>\n`
        }
        HTML.innerHTML += info
    }
}

function printDetails(){
    let identification = document.getElementById("devID");
    for(key in devInfo["driveInfo"]["Identify"]){
        identification.innerHTML += `<p><b>${key}</b>: ${devInfo["driveInfo"]["Identify"][key]}</p>`
    }
    printSessionInfo();
    printDataRemMech();
}

function printDriveJSON(){
    let outputInfo = devInfo["driveInfo"];
    delete outputInfo["Discovery 0"]["PSID feature"];
    // This is done here again, because pre-formatting in index.js didn't work
    document.getElementById("JSONdump").innerHTML += JSON.stringify(outputInfo, null, 4);
}

function saveToServer(mdJSON){
    return new Promise((resolve, reject) => {
        fetch(
            `/metadata`,
            {
                method : "POST", 
                headers: {"Content-Type": "application/json"},
                body : JSON.stringify({"index" : devInfo["index"], action : "addMetadata", "metadata" : mdJSON})
        }
        ).then((response) =>{
            if(!response.ok){
                console.error(`Failed to save metadata for drive d${devInfo["index"]}`)
                reject()
            }
            else{
                response.text().then((mdIndex) => {
                    resolve(mdIndex)
                })
            }
        })
    })

}

function removeFromServer(mdIndex){
    return new Promise((resolve, reject) => {
        fetch(
            `/metadata`,
            {
                method : "POST", 
                headers: {"Content-Type": "application/json"},
                body : JSON.stringify({"index" : devInfo["index"], action : "remMetadata", "mdIndex" : `${mdIndex}`})
        }
        ).then((response) => {
            if(!response.ok){
                console.error(`Failed to remove metadata with index ${mdIndex} from server`)
                reject()
            }
            else{
                resolve()
            }
        })
    })
}

function removeMetadata(mdIndex){
    let confirmation = confirm(`Are you sure you want to delete this metadata?`)
    if(confirmation){
        removeFromServer(mdIndex).then(() => {
            const transaction = db.transaction("metadata", "readwrite");
            const store = transaction.objectStore("metadata");
    
            const request = store.openCursor(devInfo["index"]);
            request.onsuccess = (event) => {
                let cursor = event.target.result;
                if(cursor){
                    let entries = cursor.value;
                    delete entries[mdIndex]
                    cursor.update(entries);
                    window.location.reload()
                }
            }
        })
        .catch(()=> {
            alert("Failed to remove metadata from server")
        })
    }
}

function saveToStore(metadata){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("metadata", "readwrite");
        const store = transaction.objectStore("metadata");

        const request = store.openCursor(devInfo["index"]);
        request.onsuccess = (event) => {
            let cursor = event.target.result;
            if(cursor) {
                let entries = cursor.value;
                entries = metadata;
                cursor.update(entries);
                resolve()
            }
            else{
                let addReq = store.add(metadata, devInfo["index"]);
                addReq.onsuccess = () =>{
                    console.log(`Added metadata with index ${addReq.result} successfully`);
                    resolve();
                }
                addReq.onerror = (reason) => {
                    console.error(`Failed to add metadata for ${filename}\n${reason}`);
                    reject();
                }
            }
        }
        request.onerror = (reason) => {
            console.error(`Failed to store metadata in for device d${devInfo["index"]}\n${reason}`);
            reject();
        }
    });
}

function printMetadata(){
    return new Promise((resolve, reject) => {
        let mdHTML = document.getElementById("metadataDiv")
        mdHTML.innerHTML = "";
        const transaction = db.transaction("metadata", "readwrite");
        const store = transaction.objectStore("metadata");

        const request = store.get(devInfo["index"]);
        request.onsuccess = (event) => {
            let entries = event.target.result;
            if(Object.keys(entries).length > 0) {
                Object.entries(entries).forEach(([index, content]) => {
                    let entry = `<div class="mdEntry">`
                    entry += `<div class="mdContent">`
                    if(content["name"]) entry += `<div style="display: flex; flex-direction: row;"><h4>${content["name"]}</h4>`
                    entry += `<button style="display: none;" class="authorized" id="remMDBut" onclick=removeMetadata(${index})>Remove</button></div>`
                    if(content["notes"]) entry += `<p>Notes: ${content["notes"]}</p>`
                    if(content["url"]) entry += `<p>URL: <a href="//${content["url"]}">${content["url"]}</a></p>`
                    if(content["filename"]){
                        entry += `<p>Filename: ${content["filename"]}</p>`;
                        entry += `<pre>${content["content"]}</pre>`;
                        
                    }
                    
                    entry += `</div></div>`
                    mdHTML.innerHTML += entry
                    
                });
            }
            resolve()
        }
        request.onerror = (reason) => {
            console.error(`Failed to fetch metadata for device d${devInfo["index"]}\n${reason}`);
            reject()
        }
    })
    
}

function saveMetadata(){
    let mdName = document.getElementById("mdName").value
    let inputFile = document.getElementById("mdFile");
    let note = document.getElementById("mdText").value;
    let urlContent = document.getElementById("mdUrl").value;
    if(inputFile.files.length > 0){
        let file = inputFile.files[0];
        let reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
            let data = {
                name : mdName,
                notes : note,
                url : urlContent,
                filename : file.name,
                content : reader.result
            }
            saveToServer(data).then(() => {
                window.location.reload()
            })
        }
        reader.onerror = () => {
            alert(`Failed to read uploaded file, reason:\n${reader.result}`);
        }
    }
    else{
        let data = {
            name : mdName,
            notes : note,
            url : urlContent,
            filename : null,
            content : null
        }
        saveToServer(data).then(() => {
            window.location.reload()
        })
    }   
}

function fetchMetadata(){
    return new Promise((resolve, reject) => {
        // Here a try-catch blocked is used instead of a promise catch because fetch() rejects only due to a type error, not due to a 400
        try {
            fetch(`/Metadata/drive${devInfo["index"]}.json`)
            .then((response) => {
                if(!response.ok){
                    console.error(`Failed to fetch drive${devInfo["index"]}.json`)
                    resolve();
                }
                else{
                    response.json().then((metadata) => {
                        saveToStore(metadata).then(() => {
                            resolve()
                        }) 
                        .catch(() => {
                            console.error(`Failed during fetching of metadata`)
                            reject()
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

function showMDPrompt() {
    let MDelement = document.getElementById("mdModal")
    MDelement.style.display = "flex"
    MDelement.classList.add("show")
}

function closeMDPrompt(){
    document.getElementById("mdModal").classList.remove("show")
}

function clearMDFields() {
    document.getElementById("mdName").value = ""
    document.getElementById("mdText").value = ""
    document.getElementById("mdUrl").value = ""
    document.getElementById("mdFile").value = ""
}

getSelectedDev().then(() => {
    clearMDFields()
    printDetails();
    printDriveJSON();
    fetchMetadata()
    .finally(() => {
        printMetadata()
        .finally(() => {
            checkAuthStatus();
        })
    })
});

let legButtton = document.getElementById("legendButton")
legButtton.addEventListener("mouseover", (event) => {
    document.getElementById("legendDiv").style.display = "block"
})

legButtton.addEventListener("mouseout", (event) => {
    document.getElementById("legendDiv").style.display = "none"
})