# opal-logger

## Setup
The minimal working concept was run od Python 3.10.12.

### Server
- For setup, you only need to run **python server.py**, everything should be included and should work out of the box
- The web server is spun up on **localhost:8000**
- The discovery JSONs are stored in outputs directory

### Client
- For client you only need to run **python client.py**. Currently the client pulls the JSON to be sent from outputs directory, just for simplicity
- The JSON is sent in a POST request to the server.
