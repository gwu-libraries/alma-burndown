var express = require('express'),
	app = express(),
	db = require('./module/colldev-dashboard.js'),
	bodyParser = require('body-parser');

const dateFields = ['INVOICE_STATUS_DATE', 'INVOICE_DATE'];

var options,
	invoices;

// middleware to parse the parameters sent by the 
app.use(express.static('public'));
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({
    extended: true
}));

db.loadData(start);

app.post('/burndown-data', function (req, res) {
	//console.log(invoices)
	var params = req.body,
		data = db.filterData(invoices, dateFields[0], params);

	var maxAlloc = data[1],
		menuOptions = {ledgers: options.ledgers, funds: options.getLedgerFunds(params.ledger).funds};

	//console.log(params);	
	res.send({data: data[0], maxAlloc: maxAlloc, options: menuOptions, dateKey: dateFields[0]});
});

function start (optionsDict, invoiceData) {
	options = optionsDict;
	invoices = invoiceData;
	app.listen(3000);
}
