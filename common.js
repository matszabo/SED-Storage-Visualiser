function credentialsArePresent(){
    if(localStorage.getItem("username") && localStorage.getItem("password")){
        return true
    }
    else {
        return false
    }
}

function showAuthorizedContent(){
    if(credentialsArePresent()){
        let authorizedContent = document.querySelectorAll(".authorized");
        authorizedContent.forEach((element) => {
            element.style.display = ""
        })
    }
}

function login(){
    let username, password
    username = localStorage.getItem("username")
    password = localStorage.getItem("password")

    let headers = new Headers();
    headers.set('Authorization', 'Basic ' + btoa(username + ":" + password));
    fetch(`./login`, {
        method:"POST",
        headers: headers})
    .then((response) => {
        if(response.status == 401){
            localStorage.removeItem("username");
            localStorage.removeItem("password");
            alert("Failed to login to the server. Please log in and enter your credentials again")
        }
        else if(response.status == 200){
            document.getElementById("loginBut").style.display = "none"
            showAuthorizedContent();
        }
    })
    .catch(() => {
        alert("Failed to send request to the server")
    })
}

function logout(){
    localStorage.removeItem("username");
    localStorage.removeItem("password");
    fetch(`./logout`, {
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
    if(credentialsArePresent()){
        login()
    }
}

function loginFromPrompt(){
    let username = document.getElementById("unameInput").value
    let password = document.getElementById("pwdInput").value
    localStorage.setItem("password", password);
    localStorage.setItem("username", username);
    login()
    closePrompt();
}

function closePrompt(){
    document.getElementById("loginPrompt").classList.remove("show")
}

function showprompt(){
    document.getElementById("loginPrompt").classList.add("show")
}