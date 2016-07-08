var express = require('express'),
	app = express(),
	db = require('./module/colldev-dashboard.js');

const ledgers = db.loadLedgerData(),
	invoices = db.loadInvoiceData(),
	const dateFields = ['INVOICE_STATUS_DATE', 'INVOICE_DATE'];

app.use(express.static('public'));

app.get('/burndown-data', function (req, res) {
	
	res.send(db.rollUpByDate(invoices, dateFields[0], ledgers.grandTotal));
})

