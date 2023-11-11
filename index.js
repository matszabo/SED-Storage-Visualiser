// SPDX-License-Identifier: MIT

/**
    TODO List:
    - remember checked boxes (probably using LocalStorage or smth)
    - add some basic heuristic (opal compliance)
    - add styling
    - change Single user mode from mandatory do additional and add PSID as mandatory
*/

var devFiles = [];

var dis0ManFsets = {
    "TPer Feature" : [
        "Version",
        "ComID Mgmt Supported",
        "Streaming Supported",
        "Buffer Mgmt Supported",
        "ACK/NAK Supported",
        "Async Supported",
        "Sync Supported"
    ], 
    "Locking Feature": [
        "Version",
        "HW Reset for LOR/DOR Supported",
        "MBR Shadowing Not Supported",
        "MBR Done",
        "MBR Enabled",
        "Media Encryption",
        "Locked",
        "Locking Enabled",
        "Locking Supported"
    ], 
    "Opal SSC V2.00 Feature": [
        "Feature Descriptor Version Number",
        "SSC Minor Version Number",
        "Base ComID",
        "Number of ComIDs",
        "Range Crossing Behavior",
        "Number of Locking SP Admin Authorities Supported",
        "Number of Locking SP User Authorities Supported",
        "Initial C_PIN_SID PIN Indicator",
        "Behavior of C_PIN_SID PIN upon TPer Revert"
    ], 
    "DataStore Table Feature": [
        "Version",
        "Maximum number of DataStore tables",
        "Maximum total size of DataStore tables",
        "DataStore table size alignment"
    ],
    "Block SID Authentication Feature": [
        "Version",
        "Locking SP Freeze Lock State ",
        "Locking SP Freeze Lock supported",
        "SID Authentication Blocked State",
        "SID Value State",
        "Hardware Reset"
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
};

var devices = []

/* Function stores all drives into localStorage to make it available for details page
 * This is a temporary function, as the entire logic should in future be replaced by IndexedDB
 */
function saveDevices(){
    for(let i = 0; i < devices.length; i++){
        localStorage.setItem(`d${i}`, JSON.stringify(devices[i]));
    }
}

function findUID(JSONnode, UID){
    return JSON.stringify(JSONnode).match(UID)
}

/* Function fills the minor version row in SSC V2 Feature set based on other present sets
 * Currently checks for presence of Block SID (02 mandatory addition) and of Interface
 * control template (00) by checking for its UID 0x0000020400000007 have to add PSID check for 01
 * by checking UID 000000090001ff01
 * TODO add collision explanation and further info into .html legend
 */
function setMinorVersions(){
    for(let i = 0; i < devices.length; i++){
        let cluesDetected = []
        if(devices[i]["Discovery 0"]["Opal SSC V2.00 Feature"]){ // Just in case we had Opal 1 drive somehow
            if(devices[i]["Discovery 0"]["Block SID Authentication Feature"]){
                cluesDetected.push(2)
            }
            if(findUID(devices[i]["Discovery 2"], "0x000000090001ff01")){
                cluesDetected.push(1)
            }
            if(findUID(devices[i]["Discovery 2"], "0x0000020400000007")){
                cluesDetected.push(0)
            }
            // Normal Opal 2.02
            if(2 in cluesDetected & 1 in cluesDetected & cluesDetected.length == 2 
                & devices[i]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] != 2){
                devices[i]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] += " (2)";
            }
            // Normal Opal 2.01
            else if(cluesDetected.length == 1 & 1 in cluesDetected
                    & devices[i]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] != 1){
                devices[i]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] += " (1)";
            }
            // Normal Opal 2.00
            else if(cluesDetected.length == 1 & 0 in cluesDetected
                    & devices[i]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] != 0){
                devices[i]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] += " (0)";
            }
            // Conflicts were found, print maximum found version and indicate discrepancy
            // TODO add these conflicting clues to details page of each drive
            else{
                devices[i]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] += ` (${Math.max(...cluesDetected)}!)`;
            }
        }
    }
}

function populateDevList(){
    let devList = document.getElementById("devList");
    // Using loop with index here intentionally to use index in aliases
    for(let i = 0; i < devices.length; i++){
        devList.innerHTML += `<input class="devCBox" id="d${i}" type="checkbox" checked="true"></input><a target="_blank" href="/details.html?dev=d${i}">d${i} : ${devices[i]["Identify"]["Model number"]}, Firmware version: ${devices[i]["Identify"]["Firmware version"]}</a><br>`;
        devices[i]["alias"] = `d${i}`;
    }
    let fSetList = document.getElementById("fSetManList");
    Object.entries(dis0ManFsets).forEach(([fsetName, values]) => {
        fSetList.innerHTML += `<input class="fSetCBox" id="${fsetName}" type="checkbox" checked="true">${fsetName}</input><br>`
    });
    fSetList = document.getElementById("fSetOptList");
    Object.entries(dis0optFsets).forEach(([fsetName, values]) => {
        fSetList.innerHTML += `<input class="fSetCBox" id="${fsetName}" type="checkbox" checked="true">${fsetName}</input><br>`
    });
}


// Populating body of the Feature sets table
function populateTbody(tableName, featureSet){
    let tableBody = document.getElementById(tableName);
    // Print feature set name
    Object.entries(featureSet).forEach(([fsetName, values]) => {
        let item = ""; //This is needed because items added because innerHTML will "close themselves" after each call, so we need a buffer
        item += `<tr class="fsetRow ${fsetName}" id="${fsetName}"><td class="darkCol">${fsetName}</td>`;
        // Print device names afterwards
        devices.forEach((device) => {
            item += `<td class="${device["alias"]}">${device["alias"]}</td>`;
        });
        tableBody.innerHTML += `${item}</tr>`;
        // Prepare rows for values from Feature sets
        values.forEach((value) => {
            item = "";
            // we need to combine fset name and attr value, because f.e. version could cause duplicate IDs
            item += `<tr class="${fsetName}" id="${fsetName}${value}"><td>${value}</td>`;
            // Fill features rows with values corresponding to each device
            devices.forEach((device) => {
                try {
                    item += `<td class="${device["alias"]}">${device["Discovery 0"][fsetName][value]}</td>`;
                } catch (error) {
                    item += `<td class="redBg ${device["alias"]}">N/A</td>`;
                }
            });
            tableBody.innerHTML += `${item}</tr>`;
        });
            
    });
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

async function fetchDevices(){
    let files = await fetch(`./names`);
    let filenames = await files.text();
    filenames.split(',').forEach((filename) => {
        devFiles.push(filename);
    });
    let responses = []; // A promise array
    devFiles.forEach((filename) => {
        const response = fetch(`./outputs/${filename}`);
        responses.push(response);
    });
    // Wait for all requests to finish
    let resObjects = await Promise.all(responses);
    let tmpRes = [];
    resObjects.forEach((resObj) => {
        let device = resObj.json();
        tmpRes.push(device);
    });
    // Wait for all responses to be converted to JSON
    devices = await Promise.all(tmpRes);
    populateDevList();
    setMinorVersions();
    saveDevices();
    populateTbody("manFeatures", dis0ManFsets);
    populateTbody("optFeatures", dis0optFsets);
    renderCBoxes();
}
window.onload = fetchDevices();
