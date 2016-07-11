var express = require('express'),
	app = express(),
	db = require('./module/colldev-dashboard.js'),
	bodyParser = require('body-parser');

const options = db.loadLedgerData(),
	invoices = db.loadInvoiceData(),
	dateFields = ['INVOICE_STATUS_DATE', 'INVOICE_DATE'];

// middleware to parse the parameters sent by the 
app.use(express.static('public'));
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.post('/burndown-data', function (req, res) {
	
	var params = req.body,
		data,
		menuOptions = {},
		maxAlloc;

	if (!params.ledger && !params.fund) {
		maxAlloc = options.grandTotal;
		data = db.rollUpByDate(invoices, dateFields[0], maxAlloc);
		menuOptions = {ledgers: options.ledgers.values(), funds: options.funds.values()};
	}
	else {
		data = db.filterData(invoices, params);
		maxAlloc = data[1];
		data = db.rollUpByDate(data[0], dateFields[0], maxAlloc);
		menuOptions = {ledgers: options.ledgers.values(), funds: db.getMenuValues(params.ledger)};
	}

	//console.log(data) 
	res.send({data: data, maxAlloc: maxAlloc, options: menuOptions});
});

app.listen(3000);

