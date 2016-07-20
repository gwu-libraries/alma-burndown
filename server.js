var express = require('express'),
	app = express(),
	db = require('./module/colldev-dashboard.js'),
	bodyParser = require('body-parser');

const dateFields = ['INVOICE_STATUS_DATE', 'INVOICE_DATE'];

var options;

app.use(express.static('public'));
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({
    extended: true
}));

// the class has a static method for loading the data from the db backend, which return a thenable
// inside the thenable, we initialize the class, to make sure that the async db call has been completed before passing in the data
// finally, we call the function to launch the app 
db.LedgersFunds.loadData('GW 2015/2016').then((data) => {
	console.log('app starting...');
	options = new db.LedgersFunds(data);
	start();
})
.catch((e) => {
	console.log(e);
})

app.post('/burndown-data', function (req, res) {
	
	var params = req.body;
	//the call to the backend returns a thenable; send the data only once the db query is successful
	db.getInvoiceData(params).then((data) => {
		// find the total for the selected ledger or fund. (If 'all funds' is passed, then the user has selected a ledger)
		var total = (params.fund == 'All funds') ? options[params.ledger][0].value : options[params.fund].value,
			resData = db.postProcess(data, total),
			resOptions = {ledgers: options.ledgers, funds: options[params.ledger]};
			// for each AJAX call, need to return 1) a filtered, aggregated dataset, 2) the max for the Y axis, 3) a list of menu options
			res.send({data: resData, maxAlloc: total, options: resOptions});

		})
		.catch((e) => {
			console.log(e);
		});
});

function start () {
	console.log('app started!');
	app.listen(3000);
}
