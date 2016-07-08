var d3 = require('d3'),
	fs = require('fs');

// define column names as constants for ease of adjustment later
const amount = 'AMOUNT',
	allocation = 'CURRENT_ALLOCATION',
	ledgerName = 'LEDGER_NAME',
	fundName = 'FUND_NAME';

// data file names stored in external file
var filenames = require('../data/filenames.json');

// for formatting/parsing the date fields
var dateParser = d3.timeParse("%Y-%m-%d %H:%M:%S"),
	keyFormatter = d3.timeFormat('%Y-%m-%d');

var exports = module.exports = {};

function parseDates (data) {
	/*not sure this is necessary - just in case */	
	return data.map(function (d) {
		dateFields.forEach(function (dateKey) {
			d[dateKey] = fullFormat.parse(d[dateKey]);
		})
		return d;
	});

}

function stringsToNum(d, cells) {
	/*utility func to convert strings to numbers. Accepts an object corresponding to a row in a data table and an array of cells to modify*/
	cells.forEach(function (c) {
			d[c] = +d[c];
		});
	return d;
}

function ledgerDictObj (data) {
	/* input to this func should be an array of objects, where values consist of funds (in Voyager 9, at the "Allocated" level), plus the associated net allocation for the year and the associated ledger name.

	This function stores in a map (using the d3.map function -- see https://github.com/d3/d3-collection/blob/master/README.md#maps) the total allocation on a given ledger and the relevant funds
	*/
	data = data.sort(function (a, b) {			// first sort the array by ledger name
		return a[ledgerName] - b[ledgerName];
	});

	var currLedger;		// hold the last ledger encountered

	data.forEach(function (d) {
		this[d[fundName]] = +d[allocation];	// for each fund, store that as the key to its allocation for quick lookup

		if (d[ledgerName] != currLedger) {			// haven't seen this ledger before: initialize the map to hold the associated funds and the running total
			currLedger = d[ledgerName];
			this[currLedger] = d3.map({total: +d[allocation], funds: [d[fundName]]});
		}
		else {
			this[currLedger].set('total', this[currLedger].get('total') + +d[allocation]);	// increment running total
			var funds = this[currLedger].get('funds');
			funds.push(d[fundName]);
			this[currLedger].set('funds', funds); 		// add to the list of funds
		}
	}, this);
	return this;
}

exports.rollUpByDate = function (data, dateKey, maxAlloc) {
	/*Groups the data by date and sums over the amount field */

	var nest = d3.nest()
			.key(function (d) {
				return keyFormatter(d[dateKey]);
			})
			.sortKeys(function (a, b) {
				return new Date(a) - new Date(b);
			})
			.rollup(function (leaves) {
				return {sum: d3.sum(leaves, function (d) {
					return d[amount];
				})};
			});

	data = nest.entries(data);

	cumSum = 0;
	data.forEach(function (d, i) {
		cumSum += d.values.sum;	
		d.values.cumsum = maxAlloc - cumSum;
	});

	//console.log(data);
	return data;
} 

exports.loadLedgerData = function () {	
	/* loads the CSV ledger data file and builds the dict of ledgers and funds (for the menus) */

	var ledgers = fs.readFileSync('./data/' + filenames['ledgers'], 'utf-8');
	
	ledgers = d3.csvParse(ledgers);
	
	var ledgerDict = new ledgerDictObj(ledgers);
	
	return ledgerDict;

}

exports.loadInvoiceData = function () {	
	/* loads the CSV invoice data file and does the initial parsing and roll up */

	var invoices = fs.readFileSync('./data/' + filenames['invoices'], 'utf-8');

	invoices = d3.csvParse(invoices, function (d) {		// using the row function to turn the AMOUNT into a number
		return stringsToNum(d, [amount]);
	});

	return invoices;

}