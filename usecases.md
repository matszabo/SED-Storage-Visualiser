# Client-side
This part will focus on admin features of this project. By default, unauthorized users will be able to see the generated tables, apply filters, select drives,
view info about compliance by hovering over highlighted values and look into details of each drive.

Admin is able to add drives to the server, remove drives from the server, add SSC definitions and add and remove metadata for each drive. You can access
these features by logging in with the credentials you provided during setup.

## Landing page

### Managing drives
You can add additional drives by clicking the **Devices** button on top of the Mandatory table, finding the add device section, selecting and submitting the
file. The expected file format is JSON. The tool expects the format provided by Opal Toolset. However, you can also submit a file which has only *Identify* 
and *Discovery 0* (this was done to accomodate for some bugs we had in the past). The minimal structure is then:

```json
{
    "Identify": {
        "Atrribute" : "value",
        "Atrribute" : "value"
    },
    "Discovery 0": {
        "Feature": {
            "Atrribute" : number,
            "Atrribute" : number
        }
    }
}
```

You can remove each drive by clicking the "X" button next to it. 

NOTE: You can also add and remove drives by directly adding or removing files on the server-side. Be wary though that when you add a new drive, you should
stick to the naming convention *driveN.json*, where N is a number, which will be used internally as an index. All changes made on server-side to the drives 
will be  also reflected on client-side on page refresh.

### Adding SSCs
You can add your own SSC definition by going into **Filter**, clicking **Select SSC** and providing a JSON file with the definition. The required structur
is:

```json
{
    "SSC" : "Name of the class (Opal, Pyrite, Ruby...)",
    "SSC name" : "Name of the SSC with version (Opal 2.00, Pyrite 2.02...)",
    "SSC fset" : "Name of the Feature set that defines the SSC (Opal SSC V2 Feature...)",
    "mandatory": {
        "Feature" : [
            "Attribute", # - name alone if you want to just check the presence of the attribute
            {"Atrribute" : ">=/= required_value"} # - if you want to check against specific value. Currently numeric values and >= and = operators are supported
        ]
    },
    "optional" : {
        "Feature" : [
            "Attribute",
            {"Atrribute" : ">=/= required_value"}
        ]
    }
}
```

## Details page
You can access a details page of each drive by going into **Devices** and clicking on a drive.

### Metadata management
You can add metadata to each drive by going into the **Stored Metadata** section and clicking **Add**. This section is meant to store things like 
randomness testing outputs, notes about drive behaviour etc. You can then remove that piece of metadata by clicking on the **Remove** button next to
the title of the metadata.

# Server-side
The server-side is rather thin to alleviate the pressure on it, but there are a few things that you can do as an admin to change the configuration.
This presumes that you will be connected directly to the machine running the server. No configuration changes are possible through the webpage UI.

## Changing the length of logged in session
The authentication works in the following way - after successfully authenticating to the server, the client is given a token, which is used to authorize
modifying requests (adding a drive, removing a drive, adding metadata etc.). This token has a timeout period of 8 hours and there currently isn't
a mechanic to refresh the tokens. If this isn't comfortable for you, you can go into **server.py** and edit the following line:

```python
app.permanent_session_lifetime = timedelta(hours=8)
```

## Changing credentials
Currently, credentials are only handled during the setup. If you want to change them, you can go into the **.env** file, which holds configuration
for the app. As you can see, the password is stored only as a salted Bcrypt hash. Currently, there isn't any user-friendly way to change this, but
you can generate a new password by using the following command from **setup.sh** to get a new password:

```bash
python3 -c "import bcrypt, getpass; print(bcrypt.hashpw(getpass.getpass().encode('utf-8'), bcrypt.gensalt()).decode('utf-8'))"
```

Also, the secret key is currently only generated during setup. This is done to accomodate for the fact that individual instances of server.py will be
spawned with gunicorn. This will be looked into in the future to allow for some rotation of this secret.