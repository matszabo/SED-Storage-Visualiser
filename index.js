// SPDX-License-Identifier: MIT

/**
    TODO List:
    - remember checked boxes (probably using LocalStorage or smth)
    - add styling
*/

var devFiles = [];

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
        "Version",
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
        "SSC Minor Version Number",
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


function checkPSIDpresence(){
    let PSIDhtml = document.querySelector(`[class="fsetRow PSID feature"]`);
    let addedHTML = "";
    addedHTML += `<tr class="PSID feature" id="PSID featurePresent"><td>PSID Authority present</td>`;
    for(drive in devices){
        if(findUID(devices[drive]["Discovery 2"], "0x000000090001ff01")){
            addedHTML += `<td class="${devices[drive]["alias"]}">Yes</td>`;
            devices[drive]["Discovery 0"]["PSID feature"] = {}; // Add this for future looping to indicate presence of the authority
        }
        else{
            addedHTML += `<td class="${devices[drive]["alias"]} redBg">No</td>`;
        }
    }
    PSIDhtml.insertAdjacentHTML("afterend", addedHTML);
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
        let versionDetected = -1;
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
            
            if(devices[i]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] != versionDetected){
                // Conflicts were found, print maximum found version and indicate discrepancy
                if(versionDetected == -1){
                    devices[i]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] += ` (${Math.max(...cluesDetected)}!)`;
                    devices[i]["OpalCompl"]["isCompliant"] = false;
                    devices[i]["OpalCompl"]["complBreaches"].push("SSC Minor Version conflicting (see below)");
                    devices[i]["OpalMinorVerConflicts"] = cluesDetected;
                }
                // Detected version clear, but different from reported version
                else {
                    devices[i]["Discovery 0"]["Opal SSC V2.00 Feature"]["SSC Minor Version Number"] += ` (${versionDetected})`;
                    devices[i]["OpalMinorVerConflicts"] = [];
                }
            }
        }
    }
}

function checkDataRemovalMech(){
    // Append the check after the html with version
    let mechanismsSupported = [];
    for(drive in devices){
        mechanismsSupported = [];
        if(("Supported Data Removal Mechanism Feature Descriptor" in devices[drive]["Discovery 0"])){
            let dis0value = parseInt(devices[drive]["Discovery 0"]["Supported Data Removal Mechanism Feature Descriptor"]["Supported Data Removal Mechanism"]);
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
                devices[i]["OpalCompl"]["isCompliant"] = false;
                devices[i]["OpalCompl"]["complBreaches"].push("Data Removal Mechanism - Cryptographic erase not supported");
                let cell = document.querySelector(`[id="Supported Data Removal Mechanism Feature DescriptorSupported Data Removal Mechanism"] .${devices[drive]["alias"]}`);
                cell.classList.add("redBg");
            }

            if(dis0value & 32){
                mechanismsSupported.push("5 (Vendor-specific Erase)");
            }
        }
        // Store this for easier access in details page
        devices[drive]["dataRemMechs"] = mechanismsSupported;
    }
}

function findMissingFsets(){
    devices.forEach((device) => {
        for(fset in dis0ManFsets){
            if(!(fset in device["Discovery 0"])){
                device["OpalCompl"]["isCompliant"] = false;
                device["OpalCompl"]["complBreaches"].push(`${fset} missing`);
            }
        }
    });
}

function populateDevList(){
    let devList = document.getElementById("devList");
    // Using loop with index here intentionally to use index in aliases
    for(let i = 0; i < devices.length; i++){
        devList.innerHTML += `<input class="devCBox" id="d${i}" type="checkbox" checked="true"></input><a target="_blank" href="/details.html?dev=d${i}">d${i} : ${devices[i]["Identify"]["Model number"]}, Firmware version: ${devices[i]["Identify"]["Firmware version"]}</a><br>`;
        devices[i]["alias"] = `d${i}`;
        devices[i]["OpalCompl"] = {
            "isCompliant" : true,
            "complBreaches" : []
        };

    }
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
            console.log(allBoxEl.classList);
            cBoxes.forEach((cBox) => {
                if(cBox.checked != allBoxEl.checked){
                    cBox.click();
                }
            });
        } 
    })
    let allDevsCBox = document.getElementById("allDevsCbox");
}

function setFsetAttrValue(fsetName, attrName, requiredValue, device){
    let devValue;
    try {
        devValue = device["Discovery 0"][fsetName][attrName];
    } catch{
        return `<td class="redBg ${device["alias"]}">Missing</td>`;
    }
    if(requiredValue !== null){
        // Parse required value into operator and value
        requiredValue = requiredValue.split(" ");
        let op = requiredValue[0]
        if(operators[op](parseInt(devValue), parseInt(requiredValue[1]))){
            return `<td class="${device["alias"]}">${devValue}</td>`;
        }
        else{
            device["OpalCompl"]["isCompliant"] = false;
            device["OpalCompl"]["complBreaches"].push(`${fsetName}: value of ${attrName} isn't ${op} ${requiredValue[1]}`);
            return `<td class="${device["alias"]} redBg">${devValue}</td>`;
        }
    }
    else{
        return `<td class="${device["alias"]}">${devValue}</td>`;
    }
}

// Populating body of the Feature sets table
function populateTbody(tableName, featureSet){
    let requiredVal;
    let tableBody = document.getElementById(tableName);
    // Print feature set name
    Object.entries(featureSet).forEach(([fsetName, attributes]) => {
        let item = ""; //This is needed because items added because innerHTML will "close themselves" after each call, so we need a buffer
        item += `<tr class="fsetRow ${fsetName}" id="${fsetName}"><td class="darkCol">${fsetName}</td>`;
        // Print device names afterwards
        devices.forEach((device) => {
            item += `<td class="${device["alias"]}">${device["alias"]}</td>`;
        });
        tableBody.innerHTML += `${item}</tr>`;
        // Prepare rows for values from Feature sets
        attributes.forEach((attribute) => {
            requiredVal = null;
            item = "";
            // If atrribute has a required value
            if(typeof attribute == "object"){
                requiredVal = attribute[Object.keys(attribute)];
                attribute = Object.keys(attribute);
            }
            // we need to combine fset name and attr value, because f.e. version could cause duplicate IDs
            item += `<tr class="${fsetName}" id="${fsetName}${attribute}"><td>${attribute}</td>`;
            // Fill features rows with values corresponding to each device
            devices.forEach((device) => {
                item += setFsetAttrValue(fsetName, attribute, requiredVal, device);
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
    populateTbody("manFeatures", dis0ManFsets);
    populateTbody("optFeatures", dis0optFsets);
    checkDataRemovalMech();
    checkPSIDpresence();
    findMissingFsets();
    renderCBoxes();
    saveDevices();
}
window.onload = fetchDevices();
