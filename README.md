# SED Storage Visualiser
This project is a visualiser for outputs of Opal Toolset. It allows you to upload Discovery 0 outputs to it and then check the compliance of reported
values according to pre-defined SSC definitions. This version comes with Opal 2.00 - 2.02 and Pyrite 2.02 pre-defined, but you can add your own SSC
definitions.

Furthermore, you can add your own metadata to individual drives, to keep any testing you've done on them near.

The backed of this project is split into 2 parts: Flask server and a proxy like nginx. This was done to alleviate pressure on the Flask webserver, and to
implement HTTPS more easily. If you don't want a proxy, then you'll need to modify the server.py to let Flask itself handle the HTTPS. HTTPS is needed to
protect authentication of the created admin during logins.

## Requirements
- Python 3.10 and higher
- Python 3 venv
- nginx or some other proxy
(Tested on Ubuntu 22.04.4 LTS and Debian 12.5.0)
## Setup
There are two part to the setup of this tool. 

First, the setup of the Flask server can be done using **setup.sh**. This will create a Python virtual enviroment, fetch the required modules
and create a configuration for the server itself. You'll be asked to provide a name and a password for authentication to the authorized part of
the app.

Second, a proxy. This project was tested with nginx, which is also recommended by Flask documentation authors. To help you with configuration, I've
added the **nginxExample.conf** file, which is quite easy to modify and based on a generator by Mozilla. This is a reduced example used with a
self-signed certificate. For a more complete example, you can go to [Mozilla's website](https://ssl-config.mozilla.org/).

## Run the project
**Make sure you have your virtual enviroment activated**
```bash
. .venv/bin/activate
```

You can run the project by either doing

```bash
python server.py
```

or 

```bash
gunicorn --workers=3 server:app
```
and then acccess it on the address defined in your proxy config.

The gunicorn variant will spawn 3 workers, which is better if you expect more traffic to your instance of this project.

## Additional info
These were the requierements for spinning-up the project. Further info about how to work with the project is in **usecases.md**.
