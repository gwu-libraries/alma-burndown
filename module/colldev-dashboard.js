var d3 = require('d3'),
	fs = require('fs');

// define column names as constants for ease of adjustment later
const amount = 'AMOUNT',
	allocation = 'CURRENT_ALLOCATION',
	ledgerKey = 'LEDGER_NAME',
	fundKey = 'FUND_NAME',
	dateFields = ['INVOICE_STATUS_DATE', 'INVOICE_DATE'],
	pathName = './public/data/';

// data file names stored in external file

var filenames = require('./filenames.json');

var optionsDict;

// store ledger and fund allocations in internal memory for fast lookup and to populate menus

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

function reduceUtil (prev, curr, i) {

	this[curr[fundKey]] = +curr[allocation];	// for each fund, store that as the key to its allocation for quick lookup

	var fund = {key: curr[fundKey], 
				value: (this[curr[fundKey]] > 0) ? false : true};

	prev[0].total += +curr[allocation]; // running total for the all ledgers (for setting the scale of the chart)
	prev[0].funds.push(fund)

	if (prev[prev.length-1].key != curr[ledgerKey]) {	// haven't seen this ledger before: 
		funds = [{key: 'All funds', value: false}, fund]
		prev[prev.length-1].value = (prev[prev.length-1].total > 0) ? false : true;
		prev.push({key: curr[ledgerKey], value: fund.value, total: +curr[allocation], funds: funds});
			
	}

	else {
		prev[prev.length-1].total += +curr[allocation];	// increment running total
		prev[prev.length-1].funds.push(fund);	// add to the list of funds	
	}

	return prev;
}

function optionsDictObj (data) {
	/* input to this func should be an array of objects, where values consist of funds (in Voyager 9, at the "Allocated" level), plus the associated net allocation for the year and the associated ledger name.

	This function stores in a map (using the d3.map function -- see https://github.com/d3/d3-collection/blob/master/README.md#maps) the total allocation on a given ledger and the relevant funds
	*/
	data = data.sort(function (a, b) {			// first sort the array by ledger name
		return d3.ascending(a[ledgerKey], b[ledgerKey]);
	});

	this.ledgers = [{key: 'All ledgers', value: false, total: 0, funds: [{key: 'All funds', value: false}]}]
	
	// arrays for quick lookup of the total allocation at each level

	this.ledgers = data.reduce(reduceUtil.bind(this), this.ledgers);

	return this;
}

optionsDictObj.prototype.getLedgerFunds = function (ledger) {
	return this.ledgers.find(function (d) {
		return d.key == ledger;
	})
}

exports.filterData = function (data, dateKey, params) {
/* Filters the invoice-level data on either fund or ledger, returns the filtered data + the total allocation at that level*/
	//console.log(data[0])
	var maxAlloc,
		aggData;

	// need to filter the invoice table on "PARENT_FUND," not "FUND_NAME," since invoices are captured at the reporting level	
	if (params.ledger == 'All ledgers' && params.fund == 'All funds') {
		
		maxAlloc = optionsDict.ledgers[0].total;
		aggData = rollUpByDate(data, dateKey, maxAlloc);
		
	}

	else if (params.fund != 'All funds') {
		
		maxAlloc = optionsDict[params.fund];
		aggData = rollUpByDate(filterUtil(data, {key: 'PARENT_FUND', value: params.fund}), dateKey, maxAlloc);
		
	}

	else {
		
		maxAlloc = optionsDict.getLedgerFunds(params.ledger).total;
		aggData = rollUpByDate(filterUtil(data, {key: 'LEDGER_NAME', value: params.ledger}), dateKey, maxAlloc);
	}

	return [aggData, maxAlloc];
}
 
function filterUtil (data, filterDict) { 
	var filteredData = data.filter(function (d) {
			return d[filterDict.key] == filterDict.value;
		});
	//console.log(filteredData);
	return filteredData;

}

function rollUpByDate (data, dateKey, maxAlloc) {
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
	//console.log(data)
	cumSum = 0;
	data.forEach(function (d, i) {
		cumSum += d.value.sum;	
		d.value.cumsum = maxAlloc - cumSum;
	});

	return data;
} 

exports.loadData = function (callback) {	
	/* loads the CSV ledger data file and builds the dict of ledgers and funds (for the menus) */

	fs.readFile(pathName + filenames['ledgers'], 'utf-8', function (err, result) {
		
		if (err) console.log(err);

		var ledgers = d3.csvParse(result);
		
		optionsDict = new optionsDictObj(ledgers);

		fs.readFile(pathName + filenames['invoices'], 'utf-8', function (err, result) {
			
			if (err) console.log(err)

			var invoices = d3.csvParse(result, function (d) {		// using the row function to turn the AMOUNT into a number
				d = parseDates(d);
				return stringsToNum(d, [amount]);
			});

			callback(optionsDict, invoices);

		});
	});
}

