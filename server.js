var express = require('express'),
	app = express(),
	db = require('./module/colldev-dashboard.js'),
	bodyParser = require('body-parser'),
	cron = require('node-cron'),
	child = require('child_process');

//const dateFields = ['INVOICE_STATUS_DATE', 'INVOICE_DATE'];


var options,
	server,
	fiscalYear = 'GW 2015/2016';

app.use(express.static('public'));
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({
    extended: true
}));

//starts up the server
db.LedgersFunds.loadData(fiscalYear).then((data) => {
			options = new db.LedgersFunds(data);
			server = app.listen(3000);
		})
		.catch((e) => {
			console.log(e);
		})	

//Node wrapper around cron scheduler
//cron.schedule('* * * * Sun', function (){
cron.schedule('* */15 * * * *', function (){
  console.log('updating database')
  update();
});


function update () {
	
	//close server connections while database updates are being made
	server.close()
	//run the Python script as a Node child process
	//the callback is executed upon returns
	
	py = child.spawn( '/home/dsmith/voyager/VIR/bin/python', ['./cd-db-update.py']);

	py.stdout.on('data', (data) => {	
		// the class has a static method for loading the data from the db backend, which return a thenable
		// inside the thenable, we initialize the class, to make sure that the async db call has been completed before passing in the data
		console.log(data)
		db.LedgersFunds.loadData(fiscalYear).then((data) => {
			options = new db.LedgersFunds(data);
			server.listen(3000);
		})
		.catch((e) => {
			console.log(e);
		})	
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
