var express = require('express'),
	app = express(),
	db = require('./module/colldev-dashboard.js'),
	bodyParser = require('body-parser'),
	cron = require('node-cron'),
	PythonShell = require('python-shell');

//const dateFields = ['INVOICE_STATUS_DATE', 'INVOICE_DATE'];

var options,
	server,
	fiscalYear = 'GW 2015/2016';

var pyOptions = {
	mode: 'text',
	pythonPath: '/home/dsmith/voyager/VIR/bin/python',
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
				console.log('restarting server...')
				server = app.listen(3000);
			})
			.catch((e) => {
				console.log(e);
			});
}	

//Node wrapper around cron scheduler
//cron.schedule('* * * * Sun', function (){
cron.schedule('* */5 * * * *', function (){
  console.log('updating database')
  update();
});


function update () {
	
	//close server connections while database updates are being made
	server.close()
	console.log('updating...')
	//run the Python script as a Node child process
	PythonShell.run('cd-db-update.py', (err, results) => {
		if (err) throw err;
		startup();
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
