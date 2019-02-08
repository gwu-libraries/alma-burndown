# Alma Funds Expenditure Burndown Viewer

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

7. Create the following directories within the project root folder:

   * `logs`

   * `public/data`

8. Install the following files into the appropriate directories:

   * [D3.js](https://d3js.org/): `d3.min.js` into `./public/scripts`.

   * [Bootstrap](https://getbootstrap.com/): `bootstrap.min.css` into `./public/css` and `bootstrap.min.js` into `./public/scripts`.

   * [JQuery](https://jquery.com/): `jquery-3.3.1.min.js` into `./public/scripts`.

   * [Popper](https://popper.js.org/): `popper.min.js` into `./public/scripts`.

9. Run `python fetch_analytics_data.py` at the command line from the root project folder.

10. Start the Node server from the root project folder: `node server.js`. Alternately, use a process manager in production like [pm2](http://pm2.keymetrics.io/).

11. Open a browser and go to [http://localhost:3000](http://localhost:3000).

12. To refresh data from Alma Analytics, the script `update_analytics.sh` can be run as a cron job.
