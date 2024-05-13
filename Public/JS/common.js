// SPDX-License-Identifier: BSD-3-Clause

function checkToken(){
    return new Promise((resolve, reject) => {
        fetch(`/token`, {method : "POST"})
        .then((response) => {
            if(!response.ok) {
                reject()
            }
            else {
                resolve()
            }
        })
        .catch((reason) => {
            console.error(reason)
            alert("Failed token check")
            reject()
        })
    })

}

function showAuthorizedContent(){
    let authorizedContent = document.querySelectorAll(".authorized");
    authorizedContent.forEach((element) => {
        element.style.display = ""
    })
    document.getElementById("loginBut").style.display = "none"
}

function login(username, password){
    let headers = new Headers();
    headers.set('Authorization', 'Basic ' + btoa(username + ":" + password));
    fetch(`/login`, {
        method:"POST",
        headers: headers})
    .then((response) => {
        if(response.status == 401){
            alert("Failed to login to the server. Please log in and enter your credentials again")
        }
        else if(response.status == 200){
            showAuthorizedContent();
        }
    })
    .catch(() => {
        alert("Failed to send request to the server")
    })
}

function logout(){
    fetch(`/logout`, {
        method:"POST"})
    .then((response) => {
        if(response.status != 200){
            alert("Somehow managed to fail logout")
        }
        else{
            window.location.reload();
        }
    })
    .catch(() => {
        alert("Failed")
    })
}

function checkAuthStatus(){
    checkToken().then(() => {
        showAuthorizedContent()
    })
    .catch(() => {
        // Ignore as not to fill console with error messages
    })
}

function loginFromPrompt(){
    let username = document.getElementById("unameInput").value
    let password = document.getElementById("pwdInput").value
    login(username, password)
    closePrompt();
}

function closePrompt(){
    document.getElementById("loginPrompt").classList.remove("show")
}

function showprompt(){
    document.getElementById("loginPrompt").classList.add("show")
}