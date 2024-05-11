#!/bin/bash

echo "Creating Python virtual enviroment and installing packages"
python3 -m venv .venv
. .venv/bin/activate
pip3 install flask bcrypt python-dotenv gunicorn

echo "Creating configuration file for server"
SECRET_KEY=`python3 -c 'import secrets; print(secrets.token_hex())'`
echo 'SECRET_KEY="'"$SECRET_KEY"'"' > .env
read -p "Enter admin username: " ADMIN_NAME
echo 'ADMIN_NAME="'"$ADMIN_NAME"'"' >> .env
echo -n "Enter password for admin (this will be only stored as a salted hash):"
PASSWORD=`python3 -c "import bcrypt, getpass; print(bcrypt.hashpw(getpass.getpass().encode('utf-8'), bcrypt.gensalt()).decode('utf-8'))"`
echo 'PASSWORD="'"$PASSWORD"'"' >> .env

echo -e "\nFlask server is set up and ready to run on localhost:8000. Please setup your reverse proxy accordingly with HTTPS
Example of an nginx config is in nginxExample.conf
When you're done, make sure you have python virtual enviroment activated. Launch the server by running gunicorn --workers=3 server:app"