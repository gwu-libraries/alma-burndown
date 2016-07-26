var express = require('express'),
	app = express(),
	db = require('./module/colldev-dashboard.js'),
	bodyParser = require('body-parser'),
	CronJob = require('cron').CronJob,
	PythonShell = require('python-shell');

//const dateFields = ['INVOICE_STATUS_DATE', 'INVOICE_DATE'];

var options,
	server,
	fiscalYear = 'GW 2015/2016';

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
	db.LedgersFunds.loadData(fiscalYear)
			.then((data) => {
				options = new db.LedgersFunds(data);
				server = app.listen(3000);
				console.log('restarting server...')
			})
			.catch((e) => {
				console.log(e);
			});
}	

//Node wrapper around cron scheduler
//Appears to need a zero in the first slot, or else it starts up multiple times in a row
new CronJob('00 00 24 * * 7', function (){
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



app.post('/burndown-data', function (req, res) {
	
	var params = req.body;
	params.fiscal = fiscalYear;
	//the call to the backend returns a thenable; send the data only once the db query is successful
	db.getInvoiceData(params).then((data) => {
		// find the total for the selected ledger or fund. (If 'all funds' is passed, then the user has selected a ledger)
		var total = (params.fund == 'All funds') ? options[params.ledger][0].value : options[params.ledger].find((d) => {return d.key == params.fund;}).value,
			resData = db.postProcess(data, total),
			resOptions = {ledgers: options.ledgers, funds: options[params.ledger]};
			// for each AJAX call, need to return 1) a filtered, aggregated dataset, 2) the max for the Y axis, 3) a list of menu options
			res.send({data: resData, maxAlloc: total, options: resOptions});

		})
		.catch((e) => {
			console.log(e);
		});
});
