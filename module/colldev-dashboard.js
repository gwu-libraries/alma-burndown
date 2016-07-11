var d3 = require('d3'),
	fs = require('fs');

// define column names as constants for ease of adjustment later
const amount = 'AMOUNT',
	allocation = 'CURRENT_ALLOCATION',
	ledgerName = 'LEDGER_NAME',
	fundName = 'FUND_NAME',
	dateFields = ['INVOICE_STATUS_DATE', 'INVOICE_DATE'],
	pathName = './public/data/';

// data file names stored in external file

var filenames = require('./filenames.json');

// store ledger and fund allocations in internal memory for fast lookup and to populate menus
var optionsDict;

// for formatting/parsing the date fields
var dateParser = d3.timeParse("%Y-%m-%d %H:%M:%S"),
	keyFormatter = d3.timeFormat('%Y-%m-%d');

var exports = module.exports = {};

function parseDates (d) {
	/* Utility function to convert strings to dates objects. Accepts an object corresponding to a row in a data table */	
	dateFields.forEach(function (dateKey) {
		d[dateKey] = new Date(d[dateKey]);
	});

	return d;
}

function stringsToNum(d, cells) {
	/*utility func to convert strings to numbers. Accepts an object corresponding to a row in a data table and an array of cells to modify*/
	cells.forEach(function (c) {
			d[c] = +d[c];
		});
	return d;
}

function optionsDictObj (data) {
	/* input to this func should be an array of objects, where values consist of funds (in Voyager 9, at the "Allocated" level), plus the associated net allocation for the year and the associated ledger name.

	This function stores in a map (using the d3.map function -- see https://github.com/d3/d3-collection/blob/master/README.md#maps) the total allocation on a given ledger and the relevant funds
	*/
	data = data.sort(function (a, b) {			// first sort the array by ledger name
		return a[ledgerName] - b[ledgerName];
	});

	var currLedger;		// hold the last ledger encountered

	this.grandTotal = 0;
	
	// arrays for quick lookup (for populating the UI menu)
	this.funds = d3.set();
	this.ledgers = d3.set();

	data.forEach(function (d) {
		this[d[fundName]] = +d[allocation];	// for each fund, store that as the key to its allocation for quick lookup
		this.grandTotal += +d[allocation];
		this.funds.add(d[fundName]);

		if (d[ledgerName] != currLedger) {			// haven't seen this ledger before: initialize the map to hold the associated funds and the running total
			currLedger = d[ledgerName];
			this[currLedger] = d3.map({total: +d[allocation], funds: [d[fundName]]});
			this.ledgers.add(currLedger);
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

exports.getMenuValues = function (ledgerSelected) {
/* creates array for D3 with the funds for the selected ledger, indicating which have positive allocations. 
The -false- values will be greyed out in the menu. */
	return optionsDict[ledgerSelected].get('funds').reduce(function (prev, curr) {
		if (optionsDict[curr] > 0) {
			prev.push({key: curr, value: true});
		}
		else {
			prev.push({key: curr, value: false});
		}
		return prev;
	}, []);
}

exports.filterData = function (data, params) {
/* Filters the invoice-level data on either fund or ledger, returns the filtered data + the total allocation at that level*/
	var maxAlloc,
		filterKey = {};

	// need to filter the invoice table on "PARENT_FUND," not "FUND_NAME," since invoices are captured at the reporting level	
	if (params.fund) {
		maxAlloc = optionsDict[params.fund];
		filterKey.key = 'PARENT_FUND';
		filterKey.value = params.fund;
	}

	else {
		maxAlloc = optionsDict[params.ledger].get('total');
		filterKey.key = 'LEDGER_NAME';
		filterKey.value = params.ledger;
	}

	
	return [data.filter(function (d) {
			return d[filterKey.key] == filterKey.value;
		}), maxAlloc];
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
		cumSum += d.value.sum;	
		d.value.cumsum = maxAlloc - cumSum;
	});

	//console.log(data);
	return data;
} 

exports.loadLedgerData = function () {	
	/* loads the CSV ledger data file and builds the dict of ledgers and funds (for the menus) */

	var ledgers = fs.readFileSync(pathName + filenames['ledgers'], 'utf-8');
	
	ledgers = d3.csvParse(ledgers);
	
	optionsDict = new optionsDictObj(ledgers);
	
	return optionsDict;

}

exports.loadInvoiceData = function () {	
	/* loads the CSV invoice data file and does the initial parsing and roll up */

	var invoices = fs.readFileSync(pathName + filenames['invoices'], 'utf-8');

	invoices = d3.csvParse(invoices, function (d) {		// using the row function to turn the AMOUNT into a number
		d = parseDates(d);
		return stringsToNum(d, [amount]);
	});

	return invoices;

}