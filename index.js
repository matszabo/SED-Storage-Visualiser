// SPDX-License-Identifier: MIT

/**
    TODO List:
    - change handling of number of devs - count only successfully stored
    - fetchDevices - check connection
    - change naming of indexCursor - maybe change entire name of index property?
    - add styling
    - add secure messaging check
    - consider size of all possible SSCs (is LocalStorage enough?)
*/

var db;
var numofDevs = 0;
var selectedSSC = "";
var dis0ManFsets = {};
var dis0optFsets = {};
var SSC = "";

// For easier check of required values when filling TBody
var operators = {
    '=' : function(a, b) {return a == b},
    '>=' : function(a, b) {return a >= b}
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

function filterDevs(){
    let value = document.getElementById("searchDev").value
    if(!value) return;
    let allCbox = document.getElementById("allDevsCbox");
    if(allCbox.checked) allCbox.click();
    let refs = document.getElementsByClassName("devRef");
    for(let ref of refs){
        if(ref.textContent.toLowerCase().includes(value.toLowerCase())){
            let cbox = document.querySelector(`[id="${ref.id}"]`);
            if(!cbox.checked) cbox.click();
        }
        else{
            let cbox = document.querySelector(`[id="${ref.id}"]`);
            if(cbox.checked) cbox.click();
        }
    }
}

function checkPSIDpresence(device){
    let driveCell = document.querySelector(`[id="PSID featurePresent"] .d${device["index"]}`);
    if("Discovery 2" in device["driveInfo"]){
        if(findUID(device["driveInfo"]["Discovery 2"], "0x000000090001ff01")){
            driveCell.innerHTML = "Yes"
            device["driveInfo"]["Discovery 0"]["PSID feature"] = {}; // Add this for future looping to indicate presence of the authority
        }
        else{
            driveCell.classList.add("missingBg");
            driveCell.innerHTML = `No`;
        }
    }
    else{
        driveCell.classList.add("orBg");
        driveCell.innerHTML = `Unknown`;
    }
}

/* Function fills the minor version row in SSC V2 Feature set based on other present sets
 * Currently checks for presence of Block SID (02 mandatory addition) and of Interface
 * control template (00) by checking for its UID 0x0000020400000007 have to add PSID check for 01
 * by checking UID 000000090001ff01
 */
function setMinorVersions(device){
    let versionHTML = document.querySelector(`[id="Opal SSC V2.00 FeatureSSC Minor Version Number"] .d${device["index"]}`);
    let cluesDetected = [];
    let versionDetected = -1;
    if(device["driveInfo"]["Discovery 0"]["Opal SSC V2.00 Feature"]){ // Just in case we had Opal 1 drive somehow
        let minorVerNum = device["driveInfo"]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"];
        if("Discovery 2" in device["driveInfo"]){
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
            
            if(minorVerNum != versionDetected){
                // Conflicts were found, print maximum found version and indicate discrepancy
                if(versionDetected == -1){
                    versionHTML.innerHTML = `${minorVerNum} (${Math.max(...cluesDetected)}!)`;
                    device["SSCCompl"]["isCompliant"] = false;
                    //debugger;
                    if(device["SSCCompl"]["OpalMinorVerConflicts"].length == 0){
                        device["SSCCompl"]["complBreaches"].push("SSC Minor Version conflicting (see below)");
                        device["SSCCompl"]["OpalMinorVerConflicts"] = cluesDetected;
                    }
                }
                // Detected version clear, but different from reported version
                else {
                    versionHTML.innerHTML = `${minorVerNum} (${versionDetected})`;
                    device["SSCCompl"]["OpalMinorVerConflicts"] = [];
                }
            }
        }
        else{
            versionHTML.innerHTML = `${minorVerNum} (unknown)`;
            device["SSCCompl"]["OpalMinorVerConflicts"] = [];
        } 
    }
}

function checkDataRemovalMech(device){
    let mechanismsSupported = [];
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
            device["SSCCompl"]["isCompliant"] = false;
            device["SSCCompl"]["complBreaches"].push("Data Removal Mechanism - Cryptographic erase not supported");
            let cell = document.querySelector(`[id="Supported Data Removal Mechanism Feature DescriptorSupported Data Removal Mechanism"] .d${device["index"]}`);
            cell.classList.add("missingBg");
        }

        if(dis0value & 32){
            mechanismsSupported.push("5 (Vendor-specific Erase)");
        }
    }
    // Store this for easier access in details page
    device["dataRemMechs"] = mechanismsSupported;
}

function findMissingFsets(device){
    for(fset in dis0ManFsets){
        if(!(fset in device["driveInfo"]["Discovery 0"])){
            device["SSCCompl"]["isCompliant"] = false;
            device["SSCCompl"]["complBreaches"].push(`${fset} missing`);
        }
    }
}

function populateDevList(){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("drives", "readonly");
        const store = transaction.objectStore("drives");
        let devList = document.getElementById("devList");
        devList.innerHTML = `<input type="checkbox" class="devCBox" name="allDevs" checked="true" id="allDevsCbox">All<br>`;
    
        const request = store.openCursor();
        request.onsuccess = ((event) => {
            const cursor = event.target.result;
            
            if(cursor){
                let device = cursor.value;
                devList.innerHTML += `<input class="devCBox" id="d${device["index"]}" type="checkbox" checked="true"></input><a target="_blank" class="devRef" id="d${device["index"]}" href="/details.html?dev=${device["index"]}">d${device["index"]} : ${device["driveInfo"]["Identify"]["Model number"]}, Firmware version: ${device["driveInfo"]["Identify"]["Firmware version"]}</a><br>`;
                cursor.continue();
            }
            else{
                // Adding listeners to "All" Cboxes has to happen AFTER all of the device CBoxes were created
                let fSetList = document.getElementById("fSetManList");
                fSetList.innerHTML = `<input type="checkbox" class="manFsetCbox" name="allDevs" checked="true" id="allManFsetCbox">All<br>`;
                Object.entries(dis0ManFsets).forEach(([fsetName, values]) => {
                    fSetList.innerHTML += `<input class="fSetCBox manFsetCbox" id="${fsetName}" type="checkbox" checked="true">${fsetName}</input><br>`
                });
                fSetList = document.getElementById("fSetOptList");
                fSetList.innerHTML = `<input type="checkbox" class="optFsetCbox" name="allDevs" checked="true" id="allOptFsetCbox">All<br>`;
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
                resolve();            
            }
        });
        request.onerror = ((reason) => {
            console.error(`Failed to open cursor for object store\n${reason}`);
            reject();
        });
    });
}

function setFsetAttrValue(device, fsetName, attrName, requiredValue){
    let devValue;
    let HTMLitem = document.querySelector(`[id="${fsetName}${attrName}"] .d${device["index"]}`);
    try {
        devValue = device["driveInfo"]["Discovery 0"][fsetName][attrName];
    } catch{
        HTMLitem.innerHTML = `Missing`;
        HTMLitem.classList.add("missingBg");
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
            device["SSCCompl"]["isCompliant"] = false;
            HTMLitem.title = `${fsetName}: value of ${attrName} should be ${op} ${requiredVal[1]}`;
            HTMLitem.innerHTML = `${devValue}`;
            HTMLitem.classList.add("missingBg");
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

        let putReq = store.put({index : indexNum, driveInfo : drive, SSCCompl : {isCompliant : true, complBreaches : [], OpalMinorVerConflicts : []}});
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
                HTMLitem += `<td class="d${cursor.value["index"]} driveHeader">d${cursor.value["index"]}</td>`;
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
    tableBody.innerHTML = "";
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

function hideDrive(index){
    let cbox = document.querySelector(`[id="d${index}"]`);
    if(cbox.checked) cbox.click(); 
}

async function checkDevCompliance(device){
    device["SSCCompl"]["complBreaches"] = [];
    //if(!(device["devInfo"]))
    if((!Object.keys(device["driveInfo"]["Discovery 0"]).some(str => str.includes(SSC)))){
        hideDrive(device["index"]);
    }
    await populateTbody(device, dis0ManFsets);
    await populateTbody(device, dis0optFsets);

    switch (String(selectedSSC)) {
        case "Opal 2.02":
            setMinorVersions(device);
        case "Opal 2.01":
            break;
        case "Opal 2.00": 
        default:
            console.error(`Unknown SSC encountered in checkDevCompliance(): ${String(selectedSSC)}`);
            break;
    }

    checkDataRemovalMech(device);
    checkPSIDpresence(device);
    setLockingVersion(device);
    findMissingFsets(device);
}

function populateTables(){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("drives", "readwrite");
        const store = transaction.objectStore("drives");
    
        const request = store.openCursor();
        request.onsuccess = ((event) => {
            const cursor = event.target.result;
            if(cursor){
                let device = cursor.value;
                checkDevCompliance(device).then(() => {
                    cursor.update(device);
                    cursor.continue();
                })
            }
            else {
                resolve();
            }
        });
        request.onerror = ((reason) => {
            console.error(`Failed to open drives Object Store in fetchDevices()`);
            resolve();
        });
    });

} 

async function regenerateSSC(SSCname){
    let SSCbuttonsHTML = document.querySelectorAll(`[id="SSCbuttons"] button`);
    SSCbuttonsHTML.forEach((buttonHTML) => {
        buttonHTML.classList.value = "deselectedButton";
    })
    let selectedButton = document.querySelector(`[id="${SSCname}"]`);
    selectedButton.classList.add("selectedButton");
    let SSCtext = localStorage.getItem(SSCname);
    let SSCjson = JSON.parse(SSCtext);

    selectedSSC = SSCjson["SSC name"];
    SSC = SSCjson["SSC"];
    dis0ManFsets = SSCjson["mandatory"];
    dis0optFsets = SSCjson["optional"];

    await populateDevList();

    renderCBoxes();

    await generateTbody("manFeatures", dis0ManFsets);
    await generateTbody("optFeatures", dis0optFsets);

    populateTables();
}

async function fetchDevices(){
    let files = await fetch(`./names`);
    let filenames = await files.text();
    let SSCfiles = await fetch(`./SSCs`);
    let SSCfilenames = await SSCfiles.text();

    SSCfilenames =  SSCfilenames.split(',');
    let SSCjson;
    let i;
    for(i in SSCfilenames){
        let response = await fetch(`./SSCs/${SSCfilenames[i]}`);
        let SSCstring = await response.text();
        SSCjson = JSON.parse(SSCstring);
        localStorage.setItem(SSCfilenames[i], SSCstring);
        // the filename is used here because using the SSC name was proving troublesome due to unexpected behaviour of the string
        document.getElementById("SSCbuttons").innerHTML += `<button onclick=regenerateSSC("${SSCfilenames[i]}") id="${SSCfilenames[i]}">${SSCjson["SSC name"]}</button>`;
    }
    SSCjson = JSON.parse(localStorage.getItem(SSCfilenames[0]));
    selectedSSC = SSCjson["SSC name"];
    SSC = SSCjson["SSC"];
    dis0ManFsets = SSCjson["mandatory"];
    dis0optFsets = SSCjson["optional"];

    let selectedButton = document.querySelector(`[id="${SSCfilenames[0]}"]`);
    selectedButton.classList.add("selectedButton");

    await prepareDrives(filenames);
    await populateDevList();
    renderCBoxes();

    await generateTbody("manFeatures", dis0ManFsets);
    await generateTbody("optFeatures", dis0optFsets);

    await populateTables();
}

function openDB(){
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
        fetchDevices(db);
    });
}

window.onload = openDB();