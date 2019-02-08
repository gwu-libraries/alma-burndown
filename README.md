# voyager-dashboard

A lightweight web app for viewing Alma data as a JS chart. 

## Requirements 
* Python 3.x or greater
* Node.js 4.x or greater

## Installation Instructions

Installation has been tested on a Linux server (Ubuntu 14.04 LTS) and a Windows 7 desktop machine (with admin privileges).

1. (Optional but recommended) Create a Python 3 virtual environment for this project: https://virtualenv.pypa.io/en/stable/

2. Clone/download the files and folders in this repository into a new local folder (e.g., "dashboard").

3. From the dashboard folder, run the Node package manager (at the command line) to install the dependencies.

	`home/dashboard/npm install`

4. If using virtualenv (step #1), activate the environment.

5. From the dashboard folder, install the Python dependencies. (Note: you may need to run **pip3** if you have both Python 2 and Python 3 installed on your machine and are not using virtualenv.)

	`home/dashboard/pip install -r requirements.txt` 

6. Update the `alma_analytics.ini` file. Note that this file uses the pipe `|` character to delimit key-value pairs (to avoid potential conflicts with Alma Analytics column names).

   * Enter the string value of your Alma Analytics API key under `[API_KEYS]`.

   * Enter the report names and the paths to those reports under `[PATHS]`. (The path is the provided in Alma Analytics in the Properties of each report.)

   * The paths will need to have special characters -- like spaces and forward slashes -- URL encoded and escaped. (The double `%` is necessary because of Python string formatting conventions.)

   * The optional `[COLUMN_MAP]` section provides a way to convert Alma Analytics column names to more concise strings as desired. Note that the column names must match those invoked in `scripts/alma_burndown.js`. 

7. Create the following folders within the project root folder:

   * `logs`

   * `data`
    
	10. Start the Node server:

		`dashboard/node server.js`

	11. Open a browser and go to localhost:3000/index.html

	12. (Optional) To make the dashboard accessible over HTTP to other users, there are at least two options:

		1. Change the following line in **server.js** to point to a port that is open for HTTP traffic:

			`server = app.listen(3000);` (3000 is the port number)

		2. Set up a third-party web server (like Apache) to listen on an open port and redirect traffic to the port specified by *server.js* (e.g., 3000). With Apache 2.x, you can use mod_proxy: https://httpd.apache.org/docs/current/mod/mod_proxy.html 










