function credentialsArePresent(){
    if(localStorage.getItem("username") && localStorage.getItem("password")){
        return true
    }
    else {
        return false
    }
}


function login(){
    let username, password
    if(credentialsArePresent()){
        username = localStorage.getItem("username")
        password = localStorage.getItem("password")
    }
    else{
        username = prompt("Enter your username:", "")
        password = prompt("Enter your password:", "")
        if((password == null || password == "") || (username == null || username == "")){
            console.log("Credentials prompt cancelled");
        }
        else{
            localStorage.setItem("password", password);
            localStorage.setItem("username", username);
        }
    }
    let headers = new Headers();
    headers.set('Authorization', 'Basic ' + btoa(username + ":" + password));
    fetch(`./login`, {
        method:"POST",
        headers: headers})
    .then((response) => {
        if(response.status == 401){
            alert("Failed")
        }
        else if(response.status == 200){
            document.getElementById("loginBut").style.display = "none"
            let authorizedContent = document.querySelectorAll(".authorized");
            authorizedContent.forEach((element) => {
                element.style.display = ""
            })
        }
    })
    .catch(() => {
        alert("Failed")
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