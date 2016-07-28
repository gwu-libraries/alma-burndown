var express = require('express'),
	app = express(),
	db = require('./module/colldev-dashboard.js'),
	bodyParser = require('body-parser'),
	CronJob = require('cron').CronJob,
	PythonShell = require('python-shell');


var options,
	server,
	fiscalPromise,
	selected;

var pyOptions = {
	mode: 'text',
	pythonPath: '/home/dsmith/voyager/VGR/bin/python',
	scriptPath: './'
};


app.use(express.static('public'));
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({
    extended: true
}));

startUp();

function startUp () {
	fiscalPromise = db.getFiscalPeriods();
	
	db.LedgersFunds.loadData()
		.then( (data) => {
			options = new db.LedgersFunds(data);
			server = app.listen(3000);
			console.log('restarting server...')
		})
		.catch( (e) => {
			console.log(e);
		});
}	

//Node wrapper around cron scheduler
//Appears to need a zero in the first slot, or else it starts up multiple times in a row
new CronJob('00 00 24 * * 7', () => {
  server.close()
  console.log('updating database')
  update();
}, null, true);


function update () {

	//run the Python script as a Node child process
	PythonShell.run('cd-db-update.py', pyOptions, (err, results) => {
		if (err) throw err;
		startUp();
	});
}



app.post('/burndown-data', (req, res) => {
	
	var params = req.body;
	//the call to the backend returns a thenable; send the data only once the db query is successful
	
	if ( params.fiscalPeriod ) {
			selected = params.fiscalPeriod;
		}

	db.getInvoiceData(params, selected).then( (data) => {
		//drill down the level of the options dict for the select fiscal period
		

		var thisObj = options[selected];
		
		// find the total for the selected ledger or fund. (If 'all funds' is passed, then the user has selected a ledger)
		var total = (params.fund == 'All funds') ? thisObj[params.ledger][0].value 
												: thisObj[params.ledger].find( (d) => {
													return d.key == params.fund;
												}).value,
			resData = db.postProcess(data, total),
			resOptions = {ledgers: thisObj.ledgers, funds: thisObj[params.ledger] || null}; // set the funds to null if 'All ledgers' is the selection (don't need to display fund menu)
			// for each AJAX call, need to return 1) a filtered, aggregated dataset, 2) the max for the Y axis, 3) a list of menu options
			res.send({data: resData, maxAlloc: total, options: resOptions});

		})
		.catch( (e) => {
			console.log(e);
		});
});

app.post('/fiscal-periods', (req, res) => {
	/*Serves fiscal period options to burndown.js for populating the menu*/
	fiscalPromise.then( (data) => {
		selected = data[0].key; // initialize the last selected to the default value
		res.send({fiscalPeriods: data});	
	})
	
	
});
