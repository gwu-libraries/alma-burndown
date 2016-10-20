# voyager-dashboard

A lightweight web app for viewing Voyager data in chart and table form. 

## Requirements 
* Python 3.4 or greater
* Node.js 4.4.7 or greater
* PostgreSQL database server, 9.4 or greater
* Oracle Instant Client (version appropriate to your version of Voyager)

## Installation Instructions

Installation has been tested on a Linux server (ubuntu 14.04 LTS) and a Windows 7 desktop machine (with admin privileges).

1. Create a new postgreSQL database and create/associate a user with this database.  
	
	1. For platform-specific installation instructions, see https://wiki.postgresql.org/wiki/Detailed_installation_guides
	
	2. On creating new users in postgreSQL, see the documentation here: https://www.postgresql.org/docs/9.5/static/app-createuser.html
	
	3. In the psql shell, run this command to grant the user privileges to read, write, and create tables on the new database: 
	
		`GRANT ALL ON DATABASE [database name] TO [user name];`
	
	Or see the documentation here: https://www.postgresql.org/docs/9.5/static/sql-grant.html

2. Install Node.js: https://nodejs.org/en/

3. Install Python 3: https://www.python.org/downloads/

4. Install the Oracle Instant Client packages (necessary to communicate with the Voyager database).

   1. Select the packages appropriate to the version of Oracle that corresponds to your version of Voyager (as described in the Voyager documentation). Instant Client packages can be found here: http://www.oracle.com/technetwork/database/features/instant-client/index-097480.html

   2. Download and install both the Basic and ODBC packages.

5. Install the voyager-dashboard.

	1. (Optional but recommended) Create a Python 3 virtual environment for this project: https://virtualenv.pypa.io/en/stable/

	2. Clone/download the files and folders in this repository into a new local folder (e.g., "dashboard").

	3. From the dashboard folder, run the Node package manager (at the command line) to install the dependencies.

	`home/dashboard/npm install`

	4. If using virtualenv (step #1), activate the environment.

	5. From the dashboard folder, install the Python dependencies. (Note: you may need to run **pip3** if you have both Python 2 and Python 3 installed on your machine and are not using virtualenv.)

	`home/dashboard/pip install -r requirements.txt` 

	6. Modify the following lines in **dashboard/cd-db-update.py** to reflect your system setup:

		`#!/home/ENV/bin/python**`  (path to the Python interpreter in your virtualenv or for your system)

		`log_dir = '/home/your_directory/your_log_directory/'` (path to a directory within your dashboard directory that will hold the SQL error log files)

		`engine = sqlalchemy.create_engine(('postgresql://username:password@localhost:portnum/db_name'))` (credentials for the local postrgreSQL database created in Step 1)

		`dsn = cx_Oracle.makedsn('**DSN for the Voyager database**')` See http://cx-oracle.readthedocs.io/en/latest/module.html#cx_Oracle.makedsn

		`connection = cx_Oracle.connect('**username**', '**password**', dsn)` Credentials for Oracle Voyager access 

	7. Modify the following lines in **dashboard/public/queries.json**:

		~~~~ 
		"connection": {"host": "localhost",
					"port": "**your_postgres_port_number**",
					"database": "**your_postgres_db_name**",
					"user": "**username**",
					"password": "**password**"
				}
		~~~~

	8. Modify the following lines in **dashboard/server.js**:

		~~~~
		var pyOptions = { mode: 'text',
						pythonPath: '**the full path to your Python shell**',
						scriptPath: './'
					};
		~~~~

	9. Run **cd-db-update.py** to do the initial load from Voyager into the postgreSQL database:

		`dashboard/python cd-db-update.py`

	10. Start the Node server:

		`dashboard/node server.js`

	11. Open a browser and go to localhost:3000/index.html

	12. (Optional) To make the dashboard accessible over HTTP to other users, there are at least two options:

		1. Change the following line in **server.js** to point to a port that is open for HTTP traffic:

			`server = app.listen(3000);` (3000 is the port number)

		2. Set up a third-party web server (like Apache) to listen on an open port and redirect traffic to the port specified by *server.js* (e.g., 3000). With Apache 2.x, you can use mod_proxy: https://httpd.apache.org/docs/current/mod/mod_proxy.html 










