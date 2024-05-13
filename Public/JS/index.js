// SPDX-License-Identifier: BSD-3-Clause

var db;
var numofDevs = 0;
var selectedSSC = "";
var dis0ManFsets = {};
var dis0optFsets = {};
var SSC = "";

var filtrationCriteria = {
    name : "",
    SSC : "",
    supportedFsets : []
}

/* a wrapper around database call for function filterBySSCandFsets()
 * does the actual check for feature sets and SSC
 */
function filterPromise(index) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("drives", "readonly");
        const store = transaction.objectStore("drives");
        const request = store.get(index)
        request.onsuccess = ((event) => {
            let device = event.target.result
            if(filtrationCriteria.supportedFsets.length != 0) {
                // if not all fsets from SSC aray in drive then hide by drive, also check for currently selected SSC
                if(!(filtrationCriteria.supportedFsets.every(set => device["SSCCompl"]["foundFsets"].includes(set)) &&
                Object.keys(device["driveInfo"]["Discovery 0"]).some(str => str.includes(SSC)))) {
                    resolve(false)
                }
                else {
                    resolve(true)
                }
            }
            else {
                if(!(Object.keys(device["driveInfo"]["Discovery 0"]).some(str => str.includes(SSC)))){
                    resolve(false)
                }
                else {
                    resolve(true)
                }
            }
        })
        request.onerror = ((reason) => {
            console.error(reason)
            resolve(false)
        })
    })
}

async function filterBySSCandFsets(filteredDrives) {
    let deepCopy = [...filteredDrives] // A deep copy is done here so that we don't slice an array over which we're looping
    for(let drive of filteredDrives) {
        let index = parseInt(/\d+$/i.exec(drive)[0])  
        let result = await filterPromise(index)
        if(!result) {
            let driveIndex = deepCopy.indexOf(drive)
            deepCopy.splice(driveIndex, 1)
            
        }
    }
    return deepCopy
}

async function filterByCriteria() {
    let filteredDrives = []
    // by name, fill array with devs
    let value = document.getElementById("searchDev").value
    if(value) {
        let allCbox = document.getElementById("allDevsCbox");
        if(allCbox.checked) allCbox.click();
        let refs = document.getElementsByClassName("devRef");
        for(let ref of refs){
            if((ref.textContent.toLowerCase().includes(value.toLowerCase()))){
                filteredDrives.push(ref.id)
            }
        }
    }
    else {
        let refs = document.getElementsByClassName("devRef");
        for(let ref of refs){
            filteredDrives.push(ref.id)
        }
    }
    // by SSC and supported Fset
    filterBySSCandFsets(filteredDrives).then((list) => {
        for(let cbox of document.querySelectorAll(".devCBox")) {
        
            if(list.includes(cbox.id)){
                if(!cbox.checked){
                    cbox.click()
                }
            }
            else {
                if(cbox.checked) {
                    cbox.click()
                }
            }
        }
    })
}

function uploadSSC() {
    let inputFile = document.getElementById("newSSCfile")
    if(inputFile.files.length > 0) {
        let file = inputFile.files[0];
        let reader = new FileReader();
        reader.readAsText(file);
        reader.onload = (file) => {
            fetch(`/SSCs`,
                {
                    method : "POST",
                    headers: {"Content-Type": "application/json"},
                    body : reader.result
                }
                )
                .then((response) => {
                    if(response.ok) {
                        window.location.reload()
                    }
                    else {
                        response.text().then((respText) => {
                            alert(`Failed to upload new SSC\n${respText}`)
                        })
                    }
                })
        }
        reader.onerror = () => {
            alert("Failed to upload new SSC")
        }
    }
}

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
    let version = 1

    // version 2
    if("MBR Shadowing Not Supported" in device["driveInfo"]["Discovery 0"]["Locking Feature"]){
        version = 2
        // Check for version 3
        if("HW Reset for LOR/DOR Supported" in device["driveInfo"]["Discovery 0"]["Locking Feature"]){
            version = 3
        }
    }
    if(parseInt(device["driveInfo"]["Discovery 0"]["Locking Feature"]["Version"]) != version) {
        let lockVerHTML = document.querySelector(`[id="Locking FeatureVersion"] .d${device["index"]}`);
        lockVerHTML.textContent += ` (${version})`;
    }    
}

function checkPSIDpresence(device){
    let driveCell = document.querySelector(`[id="PSID featurePresent"] .d${device["index"]}`);
    if("Discovery 2" in device["driveInfo"]){
        if(findUID(device["driveInfo"]["Discovery 2"], "0x000000090001ff01")){
            driveCell.textContent = "Yes"
            device["driveInfo"]["Discovery 0"]["PSID feature"] = {}; // Add this for future looping to indicate presence of the authority
        }
        else{
            driveCell.classList.add("missingBg");
            driveCell.textContent = `No`;
        }
    }
    else{
        driveCell.classList.add("orBg");
        driveCell.textContent = `Unknown`;
    }
}

// filling out minor version field for the implicit control in populateBody()
function setOpalMinorVer(device) {
    if(device["driveInfo"]["Discovery 0"]["Opal SSC V2 Feature"]) {
        // older feature descriptor (2.01, 2.00), fill out minor version based on presence of Interface control template
        if("Discovery 2" in device["driveInfo"]) {
            if(device["driveInfo"]["Discovery 0"]["Opal SSC V2 Feature"]["Version"] == 1) {
                device["driveInfo"]["Discovery 0"]["Opal SSC V2 Feature"]["Minor Version"] = (findUID(device["driveInfo"]["Discovery 2"], "0x0000020400000007"))? 0 : 1
            }
        }  
    } 
}

/* Function fills the minor version row in SSC V2 Feature set based on other present sets
 * Currently checks for presence of Block SID (02 mandatory addition) and of Interface
 * control template (00) by checking for its UID 0x0000020400000007 have to add PSID check for 01
 * by checking UID 000000090001ff01
 */
function checkOpal2MinorVer(device){
    let versionHTML = document.querySelector(`[id="Opal SSC V2 FeatureMinor Version"] .d${device["index"]}`);
    let cluesDetected = [];
    let textHint = [];
    let versionDetected = -1;
    if(device["driveInfo"]["Discovery 0"]["Opal SSC V2 Feature"]){ // Just in case we had Opal 1 drive somehow
        if("Discovery 2" in device["driveInfo"]){
            // newlines are on the beginning because when you put array into HTML title, it will append commas to the string
            if(device["driveInfo"]["Discovery 0"]["Block SID Authentication Feature"]){
                cluesDetected.push(2)
                textHint.push("\nBlock SID Auth. Feature detected (mandatory since .02)")
            }
            if(findUID(device["driveInfo"]["Discovery 2"], "0x000000090001ff01")){
                cluesDetected.push(1)
                textHint.push("\nPSID Authority detected (mandatory since .01)")
            }
            if(findUID(device["driveInfo"]["Discovery 2"], "0x0000020400000007")){
                cluesDetected.push(0)
                textHint.push("\nInterface control template detected (removed in .01)")
            }
            // Normal Opal 2.02
            if(cluesDetected.indexOf(2) != -1 & cluesDetected.indexOf(1) != -1 & cluesDetected.indexOf(0) == -1 & selectedSSC == "Opal 2.02"){
                versionDetected = 2;
            }
            // Normal Opal 2.01
            else if(cluesDetected.indexOf(0) == -1 & cluesDetected.indexOf(1) != -1 & selectedSSC == "Opal 2.01"){
                versionDetected = 1;
            }
            // Normal Opal 2.00
            else if(cluesDetected.indexOf(0) != -1 & selectedSSC == "Opal 2.00"){
                versionDetected = 0;
            }
            
            let minorVerNum = device["driveInfo"]["Discovery 0"]["Opal SSC V2 Feature"]["Minor Version"]
            
            if(minorVerNum != versionDetected){
                // Conflicts were found, print maximum found version and indicate discrepancy
                if(versionDetected == -1){
                    versionHTML.textContent = `${minorVerNum} (${Math.max(...cluesDetected)}!)`;
                    device["SSCCompl"]["isCompliant"] = false;
                    versionHTML.title += "\nSSC Minor Version conflicting:\n";
                    versionHTML.title += textHint;
                }
                // Detected version clear, but different from reported version
                else {
                    versionHTML.textContent = `${minorVerNum} (${versionDetected})`;
                    versionHTML.title += `\nMinor version could be ${versionDetected} based on following hints:\n`
                    versionHTML.title += textHint
                }
            }
        }
        else{
            versionHTML.textContent = `${minorVerNum} (unknown)`;
            versionHTML.title += `\nVersion couldn't be properly guessed because Discovery 2 is missing in the device's analysis`
        } 
    }
}

function checkDataRemovalMech(device){
    let mechanismsSupported = [];
    if(("Supported Data Removal Mechanism Feature" in device["driveInfo"]["Discovery 0"])){
        let dis0value = parseInt(device["driveInfo"]["Discovery 0"]["Supported Data Removal Mechanism Feature"]["Supported Data Removal Mechanism"]);
        switch (SSC) {
            case "Opal":
                if(dis0value & 4){ // Mandatory
                }
                // Just mark the cell as red because this is mandatory value
                else{
                    device["SSCCompl"]["isCompliant"] = false;
                    let cell = document.querySelector(`[id="Supported Data Removal Mechanism FeatureSupported Data Removal Mechanism"] .d${device["index"]}`);
                    cell.title = "Data Removal Mechanism - Cryptographic erase must be supported"
                    cell.classList.add("missingBg");
                }
                break;
            case "Pyrite":
                if((dis0value & 2) || (dis0value & 1)){ // Mandatory
                }
                else{
                    device["SSCCompl"]["isCompliant"] = false;
                    let cell = document.querySelector(`[id="Supported Data Removal Mechanism FeatureSupported Data Removal Mechanism"] .d${device["index"]}`);
                    cell.title = "Data Removal Mechanism - Overwrite Data Erase or Block Erase must be supported"
                    cell.classList.add("missingBg");
                }
                break;
            default:
                break;
        }
        // Check supported mechanisms
        if(dis0value & 1){
            mechanismsSupported.push("0 (Overwrite Data Erase)");
        }

        if(dis0value & 2){
            mechanismsSupported.push("1 (Block Erase)");
        }

        if(dis0value & 4){
            mechanismsSupported.push("2 (Crypto Erase)");
        }

        if(dis0value & 8){
            mechanismsSupported.push("3 (Unmap)");
        }

        if(dis0value & 16){
            mechanismsSupported.push("4 (Reset Write Pointers)");
        }

        if(dis0value & 32){
            mechanismsSupported.push("5 (Vendor-specific Erase)");
        }
    }
    // Store this for easier access in details page
    device["dataRemMechs"] = mechanismsSupported;
}

function findSupportedFsets(device){
    device["SSCCompl"]["foundFsets"] = []
    for(fset in dis0ManFsets){
        if((fset in device["driveInfo"]["Discovery 0"])){
            device["SSCCompl"]["foundFsets"].push(fset);
        }
    }
    for(fset in dis0optFsets){
        if((fset in device["driveInfo"]["Discovery 0"])){
            device["SSCCompl"]["foundFsets"].push(fset);
        }
    }
}

function filterBySupportedSSC(checkbox){
   // if checked then add to SSC array, else remove from SSC array
    let fset = checkbox["dataset"]["fset"]
    if(checkbox.checked) {
        filtrationCriteria.supportedFsets.push(fset)
    }
    else {
        let index = filtrationCriteria.supportedFsets.indexOf(fset)
        filtrationCriteria.supportedFsets.splice(index, 1)
    }
    filterByCriteria()
}

function populateFilteringSection(){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("drives", "readonly");
        const store = transaction.objectStore("drives");
        let devList = document.getElementById("devList");
        devList.innerHTML = `<div class="devItem"><input type="checkbox" class="devCBox" name="allDevs" checked="true" id="allDevsCbox">All</div>`;
    
        const request = store.openCursor();
        request.onsuccess = ((event) => {
            const cursor = event.target.result;
            
            if(cursor){
                let device = cursor.value;
                let devItem = "<div class='devItem'>"
                devItem += `<input class="devCBox" id="d${device["index"]}" type="checkbox" checked="true"></input><a target="_blank" class="devRef" id="d${device["index"]}" href="HTML/details.html?dev=${device["index"]}">d${device["index"]} : ${device["driveInfo"]["Identify"]["Model number"]}, Firmware version: ${device["driveInfo"]["Identify"]["Firmware version"]}</a>`;
                devItem += `<button class="authorized" id="d${device["index"]}" style="display: none;" onclick=removeDevice(${device["index"]})>X</button><br>`
                devList.innerHTML += `${devItem}</div>`
                cursor.continue();
            }
            else{
                // Adding listeners to "All" Cboxes has to happen AFTER all of the device CBoxes were created
                let fSetList = document.getElementById("fSetManList");
                let fSetSupList = document.getElementById("fSetManSupList");
                fSetList.innerHTML = `<input type="checkbox" class="manFsetCbox" name="allDevs" checked="true" id="allManFsetCbox">All<br>`;
                fSetSupList.innerHTML = `<input type="checkbox" class="manFsetSupCbox" id="allManFsetSupCbox">All<br>`;
                Object.entries(dis0ManFsets).forEach(([fsetName, values]) => {
                    fSetList.innerHTML += `<input class="fSetCBox manFsetCbox" id="${fsetName}" type="checkbox" checked="true">${fsetName}</input><br>`
                    fSetSupList.innerHTML += `<input class="manFsetSupCbox" data-fset="${fsetName}" type="checkbox" onclick=filterBySupportedSSC(this)>${fsetName}</input><br>`
                });

                fSetList = document.getElementById("fSetOptList");
                fSetSupList = document.getElementById("fSetOptSupList");
                fSetList.innerHTML = `<input type="checkbox" class="optFsetCbox" name="allDevs" checked="true" id="allOptFsetCbox">All<br>`;
                fSetSupList.innerHTML = `<input type="checkbox" class="optFsetSupCbox" id="allOptFsetSupCbox">All<br>`;
                Object.entries(dis0optFsets).forEach(([fsetName, values]) => {
                    fSetList.innerHTML += `<input class="fSetCBox optFsetCbox" id="${fsetName}" type="checkbox" checked="true">${fsetName}</input><br>`
                    fSetSupList.innerHTML += `<input class="optFsetSupCbox" data-fset="${fsetName}" type="checkbox" onclick=filterBySupportedSSC(this)>${fsetName}</input><br>`
                });

                let allCboxes = ["allDevsCbox", "allManFsetCbox", "allOptFsetCbox", "allManFsetSupCbox", "allOptFsetSupCbox"];
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

// filling feature set atrribute value in mandatory and optional tables
function setFsetAttrValue(device, fsetName, attrName, requiredValue){
    let devValue;
    let HTMLitem = document.querySelector(`[id="${fsetName}${attrName}"] .d${device["index"]}`);
    if(!(device["SSCCompl"]["foundFsets"].includes(fsetName))) {
        HTMLitem.innerHTML = `Missing`;
        HTMLitem.classList.add("missingBg");
        return;        
    }
    else {
        if(!(attrName in device["driveInfo"]["Discovery 0"][fsetName])) {
            HTMLitem.innerHTML = `Missing`;
            HTMLitem.classList.add("missingBg");
            return;
        }
        else {
            devValue = device["driveInfo"]["Discovery 0"][fsetName][attrName];
            if(requiredValue !== null){
                let requiredVal;
                // Parse required value into operator and value
                try {
                    requiredVal = requiredValue.split(" ");
                } catch (error) {
                    console.error(`Error while parsing required SSC value. Check if the format in SSC definition is as follows: "atribute" : "operator value"`)
                    return;
                }
                
                let op = requiredVal[0]
                if(operators[op](parseInt(devValue), parseInt(requiredVal[1]))){
                    HTMLitem.innerHTML = `${devValue}`;
                }
                else{
                    HTMLitem.title = `${fsetName}: value of ${attrName} should be ${op} ${requiredVal[1]}`;
                    HTMLitem.innerHTML = `${devValue}`;
                    HTMLitem.classList.add("missingBg");
                }
            }
            else{
                HTMLitem.innerHTML = `${devValue}`;        
            }
        }
    }
}

// Populating body of the Feature sets table
function populateTbody(device, featureSet){
    let requiredVal;
    let attributes;
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
 */
function storeDrive(drive, indexNum){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("drives", "readwrite");
        const store = transaction.objectStore("drives");

        let putReq = store.put({index : indexNum, driveInfo : drive, SSCCompl : {isCompliant : true, complBreaches : []}, timeModified : Date.now()});
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
async function fetchDrive(filePath){
    let request = await fetch(filePath);
    if(!request.ok){
        console.error(`Failed to fetch drive from ${filePath}`);
        return
    }
    let index = parseInt(/.*drive(\d+)\.json$/.exec(filePath)[1])
    let driveJSON = await request.json();

    return storeDrive(driveJSON, index);
}

function deleteMissingDrives(serverIndexes, storedIndexes){
    let removalPromises = []
    
    for(let index of storedIndexes){
        if(serverIndexes.indexOf(index) < 0) {
            removalPromises.push(removeDriveFromStorage(index))
        }
    }
    return removalPromises
}

// returns drives that need to be fetched from server (based on modification date)
function getDrivesForUpdate(filelist) {
    // deep copy of object: https://developer.mozilla.org/en-US/docs/Glossary/Deep_copy
    let returnList = JSON.parse(JSON.stringify(filelist))
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("drives", "readonly");
        const store = transaction.objectStore("drives");

        const request = store.openCursor()
        request.onsuccess = ((event) => {
            const cursor = event.target.result
            if(cursor) {
                // This is done to conform with admin's way of numbering devices (at least to digits were always present)
                let index = cursor.key.toLocaleString("en-US", {minimumIntegerDigits: 2})
                let filename = `drive${index}.json`
                
                if(filename in filelist) {
                    // client creates local UTC timestamp after receiving file, so it can be newer than server's file timestamp
                    if(cursor.value["timeModified"] >= filelist[filename]) {
                        delete returnList[filename]
                    }
                }
                cursor.continue()
            }
            else {
                resolve(returnList)
            }
        })
        request.onerror = ((reason) => {
            console.error(reason)
            reject(returnList)
        })
    })
}

/* Loops through all drive filenames and calls fetchDrive to store them
 * This may look weird, but it was made to allow synchronization of various async functions
 */
async function prepareDrives(filenames){
    let drivesToFetch = [];
    let serverIndexes = []

    for(let filename in filenames) {
        serverIndexes.push(parseInt(/.*drive(\d+)\.json$/.exec(filename)[1]))
        numofDevs++
    }

    drivesToFetch = await getDrivesForUpdate(filenames)
    let responses = []; // A promise array
    for(let filename in drivesToFetch) {
        responses.push(fetchDrive(`Outputs/${filename}`));
    }
    await Promise.all(responses);

    let storedDevs = await getAllDevIDs()
    let storedIndexes = []
    for(let dev in storedDevs) {
        storedIndexes.push(parseInt(/.*d(\d+)$/.exec(dev)[1]))
    }
    await Promise.all(deleteMissingDrives(serverIndexes, storedIndexes)) 
    return;
}

function getAllDevIDs(){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("drives", "readonly");
        const store = transaction.objectStore("drives");
        let indexes = []

        const request = store.index("indexCursor");
        const indexCursor = request.openCursor()
        indexCursor.onsuccess = ((event) => {
            const cursor = event.target.result;
            if(cursor){
                indexes[`d${cursor.value["index"]}`] = cursor.value["driveInfo"]["Identify"]["Model number"]
                cursor.continue();
            }
            else {
                resolve(indexes);
            }
        });
        indexCursor.onerror = ((reason) => {
            console.error(`Failed to open cursor on index in populateTbody\n${reason}`);
            reject(null)
        });
    })
}

async function generateTbody(tableName, featureSet){
    let tableBody = document.getElementById(tableName);
    tableBody.innerHTML = "";
    let indexes = await getAllDevIDs();
    for(const fsetName in featureSet){
        let attributes = featureSet[fsetName];
        let item = ""; //This is needed because items added because innerHTML will "close themselves" after each call, so we need a buffer
        item += `<tr class="fsetRow ${fsetName}" id="${fsetName}"><td class="darkCol">${fsetName}</td>`;

        // Print device names afterwards
        for(let index in indexes) {
            item += `<td class="${index} driveHeader" title="${indexes[index]}">${index}</td>`;
        }
        tableBody.innerHTML += `${item}</tr>`;
        // This is for specific feature sets like PSID, which have no level 0 discovery table, but we need them visualised too
        if(attributes.length == 0){
            item = `<tr class="${fsetName}" id="${fsetName}Present"><td>Present</td>`;
            for(let index in indexes){
                item += `<td class="${index}"></td>`;
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
            for(let index in indexes){
                item += `<td class="${index}"></td>`;
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
    if((!Object.keys(device["driveInfo"]["Discovery 0"]).some(str => str.includes(SSC)))){
        hideDrive(device["index"]);
    }

    // pre-table-population checks
    switch (String(selectedSSC)) {
        case "Opal 2.02":
        case "Opal 2.01":
        case "Opal 2.00":
            setOpalMinorVer(device);
        case "Pyrite 2.01":
            break;
        default:
            console.error(`Unknown SSC encountered in checkDevCompliance(): ${String(selectedSSC)}`);
            break;
    }

    checkDataRemovalMech(device);
    checkPSIDpresence(device);
    findSupportedFsets(device);
    populateTbody(device, dis0ManFsets);
    populateTbody(device, dis0optFsets);

    // duplicit switch for post-table-population operations
    switch (String(selectedSSC)) {
        case "Opal 2.02":
        case "Opal 2.01":
        case "Opal 2.00":
            checkOpal2MinorVer(device);
        case "Pyrite 2.01":
            break;
        default:
            break;
    }

    setLockingVersion(device);
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
            console.error(reason);
            resolve();
        });
    });

} 

function removeSSC(fileName) {
    let confirmation = confirm(`Are you sure you want to remove ${fileName}?`)
    if(confirmation) {
        fetch(
            `/SSCs`,
            {
                method : "DELETE", 
                headers: {"Content-Type": "application/json"},
                body : JSON.stringify({"SSCfile" : fileName})
        })
        .then((response) => {
            if(!response.ok) {
                alert("Failed to remove SSC")
            }
            else {
                window.location.reload()
            }
        })
        
    }
}

// regeneration of filters and tables based on SSC change
async function regenerateSSC(SSCname){
    let SSCbuttonsHTML = document.getElementsByClassName("SSCBut");
    for(let buttonHTML of SSCbuttonsHTML) {
        buttonHTML.classList.add("deselectedButton")
        if(buttonHTML.classList.contains("selectedButton")) {
            buttonHTML.classList.remove("selectedButton")
        }
    }

    document.getElementById("searchDev").value = ""
    let selectedButton = document.querySelector(`[id="${SSCname}"]`);
    selectedButton.classList.add("selectedButton");
    let SSCtext = localStorage.getItem(SSCname);
    let SSCjson = JSON.parse(SSCtext);

    selectedSSC = SSCjson["SSC name"];
    SSC = SSCjson["SSC"];
    dis0ManFsets = SSCjson["mandatory"];
    dis0optFsets = SSCjson["optional"];

    await populateFilteringSection();

    renderCBoxes();

    await generateTbody("manFeatures", dis0ManFsets);
    await generateTbody("optFeatures", dis0optFsets);

    populateTables();
    checkAuthStatus()
}

function addDevice(){
    let inputFile = document.getElementById("devFile");
    if(inputFile.files.length > 0){
        let file = inputFile.files[0];
        let reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
            fetch(
                `/outputs`,
                {
                    method : "POST", 
                    headers: {"Content-Type": "application/json"},
                    body : reader.result
            }
            ).then((response) =>{
                if(!response.ok){
                    alert(`Failed to save new drive`)
                }
                else {
                    if(response.status == 202) {
                        console.log("Drive already exists")
                    }
                    else {
                        console.log("Drive added successfully")
                    }
                    window.location.reload()
                }
            })
        }
    }
}

function removeDriveFromStorage(index) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("drives", "readwrite");
        const store = transaction.objectStore("drives");

        const request = store.delete(index)
        request.onsuccess = (event) => {
            console.log(`Drive d${index} deleted from IndexedDb`)
            resolve()
        }
        request.onerror = (reason) => {
            console.error(reason)
            reject()
        }
    })
}

function removeDevice(index){
    let confirmation = confirm(`Are you sure you want to remove drive d${index}?`)
    if(confirmation) {
        fetch(
            `/outputs`,
            {
                method : "DELETE", 
                headers: {"Content-Type": "application/json"},
                body : JSON.stringify({"index" : index})
        })
        .then((response) => {
            if(!response.ok) {
                alert(`Failed to remove drive d${index}`)
            }
            else {
                console.log(`Disk d${index} removed successfully from server`)
                removeDriveFromStorage(index).then(() => {
                    window.location.reload()
                })
                .catch(() => {
                    alert("Failed to remove drive from internal database, but succceeded in deletion from server.\nPlease delete local database and refresh page")
                })
            }
        })
    }

}

async function fetchDevices(){
    let filenames = await fetch(`./names`);
    if(!filenames.ok){
        alert("Failed to fetch names of present drives, check your connection");
    }
    filenames = await filenames.json()
    let SSCfiles = await fetch(`./SSCs`);
    if(!SSCfiles.ok){
        console.error("Failed to fetch list of present SSCs")
    }
    let SSCfilenames = await SSCfiles.text();

    SSCfilenames =  SSCfilenames.split(',');
    let SSCjson;
    let i;
    for(i in SSCfilenames){
        let response = await fetch(`SSCs/${SSCfilenames[i]}`);
        if(!response.ok){
            console.error(`Failed to fetch SSC from: ./SSCs/${SSCfilenames[i]}`)
        }
        else{
            let SSCstring = await response.text();
            SSCjson = JSON.parse(SSCstring);
            localStorage.setItem(SSCfilenames[i], SSCstring);
            // the filename is used here because using the SSC name was proving troublesome due to unexpected behaviour of the string
            document.getElementById("SSCbuttons").innerHTML += `<div><button class="SSCBut" onclick="regenerateSSC('${SSCfilenames[i]}')" id="${SSCfilenames[i]}">${SSCjson["SSC name"]}</button><button style="display: none;" class="authorized" onclick="removeSSC('${SSCfilenames[i]}')">X</button></div>`;
        }
    }
    SSCjson = JSON.parse(localStorage.getItem(SSCfilenames[0]));
    selectedSSC = SSCjson["SSC name"];
    SSC = SSCjson["SSC"];
    dis0ManFsets = SSCjson["mandatory"];
    dis0optFsets = SSCjson["optional"];

    let selectedButton = document.querySelector(`[id="${SSCfilenames[0]}"]`);
    selectedButton.classList.add("selectedButton");

    await prepareDrives(filenames);
    await populateFilteringSection();
    renderCBoxes();

    await generateTbody("manFeatures", dis0ManFsets);
    await generateTbody("optFeatures", dis0optFsets);

    await populateTables();
    checkAuthStatus()
}

// clear object stores and reload page to have them filled again by data from server
function refetchhDB() {
    let confirmation = confirm("Are you sure you want to re-fetch all drives from the server?\nThis won't affect the server data, but may take some time to complete")

    if(confirmation) {
        const driveTransaction = db.transaction("drives", "readwrite");
        const driveStore = driveTransaction.objectStore("drives");

        const driveRequest = driveStore.clear()
        driveRequest.onsuccess = () => {
            console.log("Succesfully cleared all items from Indexddb drives store")
            const metadataTransaction = db.transaction("metadata", "readwrite");
            const metadataStore = metadataTransaction.objectStore("metadata");

            const metadataRequest = metadataStore.clear()

            metadataRequest.onsuccess = () => {
                console.log("Succesfully cleared all items from Indexddb metadata store")
                window.location.reload()
            }
            
            metadataRequest.onerror = () => {
                alert("Failed to delete all items from the browser's database. Please try reloading the page")
            }
        }

        driveRequest.onerror = () => {
            alert("Failed to delete all items from the browser's database. Please try reloading the page")
        }
    }
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

window.onload = (() => {
    document.getElementById("searchDev").value = ""
    openDB()
})
document.getElementById("loginPrompt").addEventListener('submit', (event) => {
    event.preventDefault();
    loginFromPrompt()
})

let legButtton = document.getElementById("legendButton")
legButtton.addEventListener("mouseover", (event) => {
    document.getElementById("legendDiv").style.display = "block"
})

legButtton.addEventListener("mouseout", (event) => {
    document.getElementById("legendDiv").style.display = "none"
})

document.getElementById("devButton").addEventListener("click", (event) => {
    let devContainer = document.getElementById("devsSelection")
    let devDisplay = getComputedStyle(devContainer)["display"]
    let filterContainer = document.getElementById("filterSelection")
    let filterDisplay = getComputedStyle(filterContainer)["display"]

    if(devDisplay == "none") {
        if(filterDisplay == "block") {
            filterContainer.style.display = "none"
        }

        devContainer.style.display = "block"
    }
    else {
        devContainer.style.display = "none"
    }

    
})

document.getElementById("filterButton").addEventListener("click", (event) => {
    let filterContainer = document.getElementById("filterSelection")
    let filterDisplay = getComputedStyle(filterContainer)["display"]
    let devContainer = document.getElementById("devsSelection")
    let devDisplay = getComputedStyle(devContainer)["display"]

    if(filterDisplay == "none") {
        if(devDisplay == "block") {
            devContainer.style.display = "none"
        }

        filterContainer.style.display = "block"
    }
    else {
        filterContainer.style.display = "none"
    }

})

function showItem(elementName) {
    let element = document.getElementById(elementName)
    let display = getComputedStyle(element)["display"]
    if(display == "none") {
        element.style.display = "block"
    }
    else {
        element.style.display = "none"
    }
}