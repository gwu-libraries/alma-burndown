var express = require('express'),
	app = express(),
	db = require('./module/colldev-dashboard.js'),
	bodyParser = require('body-parser');

const dateFields = ['INVOICE_STATUS_DATE', 'INVOICE_DATE'];

var options,
	invoices;

app.use(express.static('public'));
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({
    extended: true
}));

db.loadData(start);

app.post('/burndown-data', function (req, res) {
	var params = req.body,
		data = db.filterData(invoices, dateFields[0], params);

	var maxAlloc = data[1],
		menuOptions = {ledgers: options.ledgers, funds: options.getLedgerFunds(params.ledger).funds};

	// for each AJAX call, need to return 1) a filtered, aggregated dataset, 2) the max for the Y axis, 3) a list of menu options, and 4) a date key --> Is this last necessary??	
	res.send({data: data[0], maxAlloc: maxAlloc, options: menuOptions, dateKey: dateFields[0]});
});

function start (optionsDict, invoiceData) {
	options = optionsDict;
	invoices = invoiceData;
	app.listen(3000);
}
