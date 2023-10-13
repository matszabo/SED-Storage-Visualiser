//nvme0n1-discovery_all.json

/**
    TODO List:
    - Check if feature sets are missing
    - add filtering
    - add some basic heuristic (opal compliance)
    - add styling
*/

var devFiles = [];

var discovery0Features = {
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
    "Geometry Feature": [
        "Version",
        "ALIGN",
        "LogicalBlockSize",
        "AlignmentGranularity",
        "LowestAlignedLBA"
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
    "Single User Mode Feature": [
        "Version",
        "Number of Locking Objects Supported",
        "Policy",
        "All",
        "Any"
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

var devices = []

function populateDevList(){
    let devList = document.getElementById("devList");
    for(let i = 0; i < devices.length; i++){
        devList.innerHTML += `d${i} : ${devices[i]["Identify"]["Model number"]}<br>`;
        devices[i]["alias"] = `d${i}`;
    }
}



// Populating body of the Feature sets table
function populateTbody(){
    let tableBody = document.getElementById("features");
    // Print feature set name
    Object.entries(discovery0Features).forEach(([fsetName, values]) => {
        let item = ""; //This is needed because items added because innerHTML will "close themselves" after each call, so we need a buffer
        item += `<tr class="fsetRow" id="${fsetName}"><td class="darkCol">${fsetName}</td>`;
        // Print device names afterwards
        devices.forEach((device) => {
            item += `<td>${device["alias"]}</td>`;
        });
        tableBody.innerHTML += `${item}</tr>`;
        // Prepare rows for values from Feature sets
        values.forEach((value) => {
            item = "";
            // we need to combine fset name and attr value, because f.e. version could cause duplicate IDs
            item += `<tr id="${fsetName}${value}"><td>${value}</td>`;
            // Fill features rows with values corresponding to each device
            devices.forEach((device) => {
                try {
                    item += `<td>${device["Discovery 0"][fsetName][value]}</td>`;
                } catch (error) {
                    item += `<td class="redBg">N/A</td>`;
                }
            });
            tableBody.innerHTML += `${item}</tr>`;
        });
            
    });
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
    populateTbody();
    
}
window.onload = fetchDevices();
