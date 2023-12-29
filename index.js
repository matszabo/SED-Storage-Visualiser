// SPDX-License-Identifier: MIT

/**
    TODO List:
    - check integrity of passing by value - updating the cursor
    - rethink program flow
    - change to generic SSC handling
    - change handling of number of devs - count only successfully stored
    - fetchDevices - check connection
    - change naming of indexCursor - maybe change entire name of index property?
    - add styling
    - add secure messaging check
*/

var db;
var numofDevs = 0;

// For easier check of required values when filling TBody
var operators = {
    '=' : function(a, b) {return a == b},
    '>=' : function(a, b) {return a >= b}
};

// Note: PSID is not in Discovery 0, but added here to make it easier to render
var dis0ManFsets = {
    "TPer Feature" : [
        "Version",
        "ComID Mgmt Supported",
        {"Streaming Supported" : "= 1"},
        "Buffer Mgmt Supported",
        "ACK/NAK Supported",
        "Async Supported",
        {"Sync Supported" : "= 1"}
    ], 
    "Locking Feature": [
        {"Version" : ">= 3"},
        "HW Reset for LOR/DOR Supported",
        {"MBR Shadowing Not Supported" : "= 0"},
        "MBR Done",
        "MBR Enabled",
        {"Media Encryption" : "= 1"},
        "Locked",
        "Locking Enabled",
        {"Locking Supported" : "= 1"}
    ], 
    "Opal SSC V2.00 Feature": [
        "Feature Descriptor Version Number",
        {"SSC Minor Version Number" : ">= 2"},
        "Base ComID",
        {"Number of ComIDs" : ">= 1"},
        "Range Crossing Behavior",
        {"Number of Locking SP Admin Authorities Supported" : ">= 4"},
       {"Number of Locking SP User Authorities Supported" : ">= 8"},
        "Initial C_PIN_SID PIN Indicator",
        "Behavior of C_PIN_SID PIN upon TPer Revert"
    ], 
    "DataStore Table Feature": [
        "Version",
        {"Maximum number of DataStore tables" : ">= 1"},
        {"Maximum total size of DataStore tables" : ">= 0xA0000"},
        {"DataStore table size alignment" : ">= 1"}
    ],
    "Block SID Authentication Feature": [
        {"Version" : ">= 2"},
        "Locking SP Freeze Lock State ",
        "Locking SP Freeze Lock supported",
        "SID Authentication Blocked State",
        "SID Value State",
        "Hardware Reset"
    ],
    "PSID feature" :[

    ]
}; 

var dis0optFsets = {
    "Geometry Feature": [
        "Version",
        "ALIGN",
        "LogicalBlockSize",
        "AlignmentGranularity",
        "LowestAlignedLBA"
    ], 
    "Single User Mode Feature": [
        "Version",
        "Number of Locking Objects Supported",
        "Policy",
        "All",
        "Any"
    ],
    "Supported Data Removal Mechanism Feature Descriptor": [
        "Version",
        "Supported Data Removal Mechanism",
        "Data Removal Time Format for Bit 2",
        "Data Removal Time for Supported Data Removal Mechanism Bit 2"
    ],
};

function findUID(JSONnode, UID){
    return JSON.stringify(JSONnode).match(UID)
}

// This function currently works only for version 3, but is placed here for future versions
function setLockingVersion(device){
    // Check for version 3
    if("HW Reset for LOR/DOR Supported" in device["driveInfo"]["Discovery 0"]["Locking Feature"] &
    "MBR Shadowing Not Supported" in device["driveInfo"]["Discovery 0"]["Locking Feature"]){
        
    let lockVerHTML = document.querySelector(`[id="Locking FeatureVersion"] .d${device["index"]}`);
    lockVerHTML.innerHTML += " (3)";
    }   
}

function checkPSIDpresence(device){
    let driveCell = document.querySelector(`[id="PSID featurePresent"] .d${device["index"]}`);
    if(findUID(device["driveInfo"]["Discovery 2"], "0x000000090001ff01")){
        driveCell.innerHTML = "Yes"
        device["driveInfo"]["Discovery 0"]["PSID feature"] = {}; // Add this for future looping to indicate presence of the authority
    }
    else{
        driveCell.classList.add("redBg");
        driveCell.innerHTML = `No`;
    }
}

/* Function fills the minor version row in SSC V2 Feature set based on other present sets
 * Currently checks for presence of Block SID (02 mandatory addition) and of Interface
 * control template (00) by checking for its UID 0x0000020400000007 have to add PSID check for 01
 * by checking UID 000000090001ff01
 * TODO add collision explanation and further info into .html legend
 */
function setMinorVersions(device){
    let cluesDetected = [];
    let versionDetected = -1;
    if(device["driveInfo"]["Discovery 0"]["Opal SSC V2.00 Feature"]){ // Just in case we had Opal 1 drive somehow
        if(device["driveInfo"]["Discovery 0"]["Block SID Authentication Feature"]){
            cluesDetected.push(2)
        }
        if(findUID(device["driveInfo"]["Discovery 2"], "0x000000090001ff01")){
            cluesDetected.push(1)
        }
        if(findUID(device["driveInfo"]["Discovery 2"], "0x0000020400000007")){
            cluesDetected.push(0)
        }
        // Normal Opal 2.02
        if(cluesDetected.indexOf(2) != -1 & cluesDetected.indexOf(1) != -1 & cluesDetected.length == 2 ){
            versionDetected = 2;
        }
        // Normal Opal 2.01
        else if(cluesDetected.length == 1 & cluesDetected.indexOf(1) != -1){
            versionDetected = 1;
        }
        // Normal Opal 2.00
        else if(cluesDetected.length == 1 & cluesDetected.indexOf(0) != -1){
            versionDetected = 0;
        }
        
        if(device["driveInfo"]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] != versionDetected){
            // Conflicts were found, print maximum found version and indicate discrepancy
            if(versionDetected == -1){
                device["driveInfo"]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] += ` (${Math.max(...cluesDetected)}!)`;
                device["OpalCompl"]["isCompliant"] = false;
                device["OpalCompl"]["complBreaches"].push("SSC Minor Version conflicting (see below)");
                device["OpalCompl"]["OpalMinorVerConflicts"] = cluesDetected;
            }
            // Detected version clear, but different from reported version
            else {
                device["driveInfo"]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] += ` (${versionDetected})`;
                device["OpalCompl"]["OpalMinorVerConflicts"] = [];
            }
        }
    }
}

function checkDataRemovalMech(){
    const transaction = db.transaction("drives", "readwrite");
    const store = transaction.objectStore("drives");
    let device;

    const request = store.openCursor();
    request.onsuccess = ((event) => {
        const cursor = event.target.result;
        if(cursor){
            let device = cursor.value;
            let mechanismsSupported = [];
            mechanismsSupported = [];
            if(("Supported Data Removal Mechanism Feature Descriptor" in device["driveInfo"]["Discovery 0"])){
                let dis0value = parseInt(device["driveInfo"]["Discovery 0"]["Supported Data Removal Mechanism Feature Descriptor"]["Supported Data Removal Mechanism"]);
                // Check supported mechanisms
                if(dis0value & 1){
                    mechanismsSupported.push("0 (Overwrite Data Erase)");
                }
    
                if(dis0value & 2){
                    mechanismsSupported.push("1 (Block Erase)");
                }
    
                if(dis0value & 4){ // Mandatory
                    mechanismsSupported.push("2 (Crypto Erase)");
                }
                // Just mark the cell as red because this is mandatory value
                else{
                    device["OpalCompl"]["isCompliant"] = false;
                    device["OpalCompl"]["complBreaches"].push("Data Removal Mechanism - Cryptographic erase not supported");
                    let cell = document.querySelector(`[id="Supported Data Removal Mechanism Feature DescriptorSupported Data Removal Mechanism"] .d${device["index"]}`);
                    cell.classList.add("redBg");
                }
    
                if(dis0value & 32){
                    mechanismsSupported.push("5 (Vendor-specific Erase)");
                }
            }
            // Store this for easier access in details page
            device["dataRemMechs"] = mechanismsSupported;
            cursor.update(device);
            cursor.continue();
        }
    });

}

function findMissingFsets(device){
    for(fset in dis0ManFsets){
        if(!(fset in device["driveInfo"]["Discovery 0"])){
            device["OpalCompl"]["isCompliant"] = false;
            device["OpalCompl"]["complBreaches"].push(`${fset} missing`);
        }
    }
}

function populateDevList(){
    const transaction = db.transaction("drives", "readonly");
    const store = transaction.objectStore("drives");

    const request = store.openCursor();
    request.onsuccess = ((event) => {
        const cursor = event.target.result;
        let devList = document.getElementById("devList");
        if(cursor){
            let device = cursor.value;
            devList.innerHTML += `<input class="devCBox" id="d${device["index"]}" type="checkbox" checked="true"></input><a target="_blank" href="/details.html?dev=${device["index"]}">d${device["index"]} : ${device["driveInfo"]["Identify"]["Model number"]}, Firmware version: ${device["driveInfo"]["Identify"]["Firmware version"]}</a><br>`;
            cursor.continue();
        }
        else{
            // Adding listeners to "All" Cboxes has to happen AFTER all of the device CBoxes were created
            let fSetList = document.getElementById("fSetManList");
            Object.entries(dis0ManFsets).forEach(([fsetName, values]) => {
                fSetList.innerHTML += `<input class="fSetCBox manFsetCbox" id="${fsetName}" type="checkbox" checked="true">${fsetName}</input><br>`
            });
            fSetList = document.getElementById("fSetOptList");
            Object.entries(dis0optFsets).forEach(([fsetName, values]) => {
                fSetList.innerHTML += `<input class="fSetCBox optFsetCbox" id="${fsetName}" type="checkbox" checked="true">${fsetName}</input><br>`
            });
            let allCboxes = ["allDevsCbox", "allManFsetCbox", "allOptFsetCbox"];
            allCboxes.forEach((allBox) => {
                let allBoxEl = document.getElementById(allBox);
                allBoxEl.onchange = () => {
                    // The self selection has to be here, because this code is evaluated only after the event
                    let cBoxes = document.querySelectorAll(`.${allBoxEl.classList[0]}`);
                    cBoxes.forEach((cBox) => {
                        if(cBox.checked != allBoxEl.checked){
                            cBox.click();
                        }
                    });
                } 
            })            
        }
    });
    request.onerror = ((reason) => {
        console.error(`Failed to open cursor for object store\n${reason}`);
    });
}

function setFsetAttrValue(device, fsetName, attrName, requiredValue){
    let devValue;
    let HTMLitem = document.querySelector(`[id="${fsetName}${attrName}"] .d${device["index"]}`);
    try {
        devValue = device["driveInfo"]["Discovery 0"][fsetName][attrName];
    } catch{
        HTMLitem.innerHTML = `Missing`;
        HTMLitem.classList.add("redBg");
        return;
    }
    if(requiredValue !== null){
        // Parse required value into operator and value
        let requiredVal = requiredValue.split(" ");
        let op = requiredVal[0]
        if(operators[op](parseInt(devValue), parseInt(requiredVal[1]))){
            HTMLitem.innerHTML = `${devValue}`;
        }
        else{
            device["OpalCompl"]["isCompliant"] = false;
            device["OpalCompl"]["complBreaches"].push(`${fsetName}: value of ${attrName} isn't ${op} ${requiredVal[1]}`);
            HTMLitem.innerHTML = `${devValue}`;
            HTMLitem.classList.add("redBg");
        }
    }
    else{
        HTMLitem.innerHTML = `${devValue}`;
    }
}

// Populating body of the Feature sets table
async function populateTbody(device, featureSet){
    let requiredVal;
    let attributes;
    // Print feature set name
    for(const fsetName in featureSet){
        attributes = featureSet[fsetName];
        // Prepare rows for values from Feature sets
        for(let attrIndex in attributes){
            let attribute = attributes[attrIndex];
            requiredVal = null;
            item = "";
            // If atrribute has a required value
            if(typeof attribute == "object"){
                requiredVal = attribute[Object.keys(attribute)];
                attribute = Object.keys(attribute);
            }
            // Fill features rows with values corresponding to each device
            setFsetAttrValue(device, fsetName, attribute, requiredVal);
        }   
    }
}

function renderCBoxes(){
    // Filtration based on drives
    let devCBoxes = document.getElementsByClassName("devCBox");
    for(let i = 0; i < devCBoxes.length; i++){
        let checkbox = devCBoxes.item(i);
        checkbox.onclick = () => {
            let devCells = document.getElementsByClassName(checkbox.id);
            for(let j = 0; j < devCells.length; j++){
                let cell = devCells.item(j);
                
                if(!checkbox.checked){
                    cell.style.display = 'none';
                }
                else{
                    cell.style.display = "";
                }
            }
        }
    }
    // Filtration based on Feature Sets
    let fSetBoxes = document.getElementsByClassName("fSetCBox");
    for(let i = 0; i < fSetBoxes.length; i++){
        let checkbox = fSetBoxes.item(i);
        checkbox.onclick = () => {
            let fSetRow = document.getElementsByClassName(checkbox.id);
            for(let j = 0; j < fSetRow.length; j++){
                let row = fSetRow.item(j);
                
                if(!checkbox.checked){
                    row.style.display = 'none';
                }
                else{
                    row.style.display = "";
                }
            }
        }
    }
}

/* Stores the drive into IndexedDB and returns a promise
 * Even failures lead to resolution because we don't want a single failure to stop everything
 * the failure is written into console so that it's noticed by the dev
 * 
 * TODO: Describe schema of db 
 */
function storeDrive(drive, indexNum){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("drives", "readwrite");
        const store = transaction.objectStore("drives");

        let putReq = store.put({index : indexNum, driveInfo : drive, OpalCompl : {isCompliant : true, complBreaches : [], OpalMinorVerConflicts : []}});
        putReq.onsuccess = ((event) => {
            resolve();
        });
        putReq.onerror = ((reason) => {
            console.error(`Failed to put info about ${filePath} into IndexedDB\n${reason}`);
            resolve();
        });
    });
}

// Fetches a drive and returns promise for its storage
async function fetchDrive(filePath, index){
    let request = await fetch(filePath);
    let driveJSON = await request.json();
    return storeDrive(driveJSON, index);
}

/* Loops through all drive filenames and calls fetchDrive to store them
 * This may look weird, but it was made to allow synchronization of various async functions
 */
async function prepareDrives(filenames){
    let devFiles = [];
    filenames.split(',').forEach((filename) => {
        devFiles.push(filename);
    });
    let responses = []; // A promise array
    let index = 0;
    devFiles.forEach((filename) => {
        responses.push(fetchDrive(`./outputs/${filename}`, index));
        index += 1;
    });
    numofDevs = index;
    await Promise.all(responses);
    return;
}

function fillDevices(HTMLitem){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("drives", "readonly");
        const store = transaction.objectStore("drives");

        const request = store.index("indexCursor");
        const indexCursor = request.openCursor();
        indexCursor.onsuccess = ((event) => {
            const cursor = event.target.result;
            if(cursor){
                HTMLitem += `<td class="d${cursor.value["index"]}">d${cursor.value["index"]}</td>`;
                cursor.continue();
            }
            else {
                resolve(HTMLitem);
            }
        });
        indexCursor.onerror = ((reason) => {
            console.error(`Failed to open cursor on index in populateTbody\n${reason}`);
            resolve();
        });
    });
}

async function generateTbody(tableName, featureSet){
    let tableBody = document.getElementById(tableName);
    for(const fsetName in featureSet){
        let attributes = featureSet[fsetName];
        let item = ""; //This is needed because items added because innerHTML will "close themselves" after each call, so we need a buffer
        item += `<tr class="fsetRow ${fsetName}" id="${fsetName}"><td class="darkCol">${fsetName}</td>`;

        // Print device names afterwards
        item = await fillDevices(item);
        tableBody.innerHTML += `${item}</tr>`;
        // This is for specific feature sets like PSID, which have no level 0 discovery table, but we need them visualised too
        if(attributes.length == 0){
            item = `<tr class="${fsetName}" id="${fsetName}Present"><td>Present</td>`;
            for(let i = 0; i < numofDevs; i++){
                item += `<td class="d${i}"></td>`;
            }
            tableBody.innerHTML += `${item}</tr>`;
        }
        // Prepare rows for values from Feature sets
        for(let attrIndex in attributes){
            let attribute = attributes[attrIndex];
            item = "";
            // If atrribute has a required value
            if(typeof attribute == "object"){
                attribute = Object.keys(attribute);
            }
            // we need to combine fset name and attr value, because f.e. version could cause duplicate IDs
            item += `<tr class="${fsetName}" id="${fsetName}${attribute}"><td>${attribute}</td>`;
            for(let i = 0; i < numofDevs; i++){
                item += `<td class="d${i}"></td>`;
            }
            tableBody.innerHTML += `${item}</tr>`;
        }
    }   
}

async function checkDevCopmpliance(device){
    setMinorVersions(device);
    await populateTbody(device, dis0ManFsets);
    await populateTbody(device, dis0optFsets);
    checkDataRemovalMech(device);
    checkPSIDpresence(device);
    setLockingVersion(device);
    findMissingFsets(device);
}

async function fetchDevices(){
    let files = await fetch(`./names`);
    let filenames = await files.text();
    await prepareDrives(filenames);
    populateDevList();

    await generateTbody("manFeatures", dis0ManFsets);
    await generateTbody("optFeatures", dis0optFsets);

    const transaction = db.transaction("drives", "readwrite");
    const store = transaction.objectStore("drives");

    const request = store.openCursor();
    request.onsuccess = ((event) => {
        const cursor = event.target.result;
        if(cursor){
            let device = cursor.value;
            checkDevCopmpliance(device);
            // TODO double-check if update is able to finish before continue
            cursor.update(device);
            cursor.continue();
        }
    });
    request.onerror = ((reason) => {
        console.error(`Failed to open drives Object Store in fetchDevices()`);
    });

    renderCBoxes();
}

function openDB(){
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
        fetchDevices(db);
    });
}

window.onload = openDB();