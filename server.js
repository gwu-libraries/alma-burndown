var express = require('express'),
	app = express(),
	db = require('./module/colldev-dashboard.js'),
	bodyParser = require('body-parser'),
	cron = require('node-cron'),
	PythonShell = require('python-shell');


var ledgersFunds,
	server,
	fiscalPeriods,
	selected;

var pyOptions = {
	mode: 'text',
	pythonPath: '/home/dsmith/COLLDEV/bin/python',
	scriptPath: './'
};


app.use(express.static('public'));
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({
    extended: true
}));

startUp();

function startUp () {
	
	db.getFiscalPeriods()
		.then( (data) => {
			fiscalPeriods = data;
			return db.LedgersFunds.loadData();
		})
		.then( (data) => {
			ledgersFunds = new db.LedgersFunds(data);
			server = app.listen(3000);
			console.log('restarting server...')
		})
		.catch( (e) => {
			console.log(e);
		});
}	

//Node wrapper around cron scheduler
//Appears to need a zero in the first slot, or else it starts up multiple times in a row
cron.schedule('0 23 * * *', () => {
  server.close()
  console.log('updating database')
  update();
});


function update () {

	//run the Python script as a Node child process
	PythonShell.run('cd-db-update.py', pyOptions, (err, results) => {
		if (err) throw err;
		startUp();
	});
}

app.post('/item-data', (req, res) => {
	var params = req.body;

	db.getItemData(params).then( (data) => {
		res.send({data: data});
	});

});


app.post('/burndown-data', (req, res) => {
	
	var params = req.body;
	//the call to the backend returns a thenable; send the data only once the db query is successful
	db.getInvoiceData(params).then( (data) => {
		
		var ledgerArray = ledgersFunds[params.fiscalPeriod][params.ledger], //for ease of reference
			total = (params.fund == 'All funds') ? ledgerArray[0].value 
												: ledgerArray.find( (d) => {
													return d.key == params.fund;
												}).value,
			resData = db.postProcess(data, total); 
					// for each AJAX call, need to return 1) a filtered, aggregated dataset and 2) the max for the Y axis
			res.send({data: resData, maxAlloc: total});

		})
		.catch( (e) => {
			console.log(e);
		});
});

app.post('/ledger_data', (req, res) => {
	/*Serves fiscal period options to burndown.js for populating the menu*/
		res.send({fiscalPeriods: fiscalPeriods, ledgersFunds: ledgersFunds});	
	//})
	
	
});
