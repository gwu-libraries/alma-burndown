//Version 2.1. September 2016. Adding support for tabular views.
// Initializing the object will perform the requisite queries.
"use strict"
var pgp = require('pg-promise')(),
	queries = require('./queries.json');

//initialize PG database connection
var pgDb = pgp(queries.connection);

// define column names as constants for ease of adjustment later
// TO DO: is there a way to generate these programmatically, using symbols??
const amount = 'amount',
	keys = ['key', 'commits', 'expends', 'rollover', 'value'], //uses "value" for "allocation" and "key" for "_name" for D3 consistency
	fiP = 'fiscal_period_name',
	pathName = './public/data/';

var exports = module.exports = {};

//TO DO: re-write or omit; all ledger data should be loaded at the same time as the fiscal periods
exports.getFiscalPeriods = () => {
	return pgDb.any({text: queries['fiscal_periods']})
				.then( (data) => {
					return data.map( (d, i) => {
						// the key contains the name for menu display, the value > 0 turns on visibility, and the range is used for calculating start and end dates
						return {key: d.fiscal_period_name, value: i+1, range: [d.fiscal_period_start, d.fiscal_period_end]};
					})
				})
				.catch( (err) => {
					console.log(err);
				})
}

function reduceData (data, key) {
		//helper function to iterate through the keys, accumulating a new object based on the values corresponding to the passed key in the pass data element
		return keys.reduce( function (prev, curr) {				
					// iterate through the keys, accumulating a new object from the matching data values for each fund
					if (curr == 'key') prev[curr] = data[key + curr]
					else prev[curr] = +data[key + curr];
					return prev;
				}, {});
	}

//using ES6 classes for clarity
exports.LedgersFunds = class {
/*Runs query to populate the dataset of menu options. Stores in memory for speed of lookup.*/

	constructor(dataDict) {
		Object.keys(dataDict).forEach( (k) => {
			this[k] = dataDict[k]; 				// cycle through the dict of menu items and add them to the obj's properties
		}, this);

		return this;
	}

	static loadData(options) {
		/*using static method to load data prior to intialization
		see http://stackoverflow.com/questions/24398699/is-it-bad-practice-to-have-a-constructor-function-return-a-promise*/

		//returns a thenable with the data object created from the query results. This ensures that the LedgersFunds instance won't be initialized until the query has been completed.
		return pgDb.any({text: queries['ledgers']})
			.then(this.processData)
			.then( (data) => {
				return data
			})
			.catch( (err) => {
				console.log(err);
			})
	}

	static processData (data) {
	/*Populates a dict-like object with the results of the query, with keys for quick look-up of ledgers and funds, each of which returns an object for consumption by D3 methods*/

		// the default value for all ledgers needs to contain the total across all ledgers/funds
		let dataDict = {};

		//stores the complete list of ledgers for the ledgers menu
		var i = 0; // counter for assigning a unique id to each fund obj

		data.forEach( (d) => {
			//each fund key gets assigned an object bearing its name and its total allocation
			if ( !dataDict[d[fiP]] ) {
				dataDict[d[fiP]] = {};
				dataDict[d[fiP]].ledgers = [keys.reduce( function (prev, curr) {
					if (curr == 'key') prev[curr] = 'All ledgers'
					else prev[curr] = 0;
					return prev;
				}, {})]; 					// initialize the list of ledgers for this fiscal period with an empty object for "All Ledgers"
			}

			let thisObj = dataDict[d[fiP]],		// for ease of reference
				fund = reduceData(d, 'fund_');	// populate the fields with the fund data

			fund.idx = i++;

			// if this is the first time seeing this ledger, assign its total and initialize the array of its associated funds
			if ( !thisObj[d['ledger_key']] ) {

				let ledger = reduceData(d, 'ledger_');

				thisObj.ledgers.push(ledger);

				thisObj[ledger.key] = [keys.reduce(function (prev, curr) {  
					if (curr != 'key') prev[curr] = ledger[curr];		//get the values from the newly created ledger obj for the "all funds" obj
					else prev[curr] = 'All funds';		// only difference is the key name
					return prev;
				}, {idx: i++})];

				//increment the totals across all ledgers
				for ( var p in thisObj.ledgers[0] ) {
					if (p != 'key') thisObj.ledgers[0][p] += ledger[p];
				}
			}
			
			// each ledger key returns a list of associated funds
			thisObj[d['ledger_key']].push(fund); 
		});
		// copy the "all ledgers" object into an "all funds" object (for all funds across all ledgers)
		// TO DO: Is this redundancy necessary?
		Object.keys(dataDict).forEach( (k) => {
			let copyObj = Object.assign({}, dataDict[k].ledgers[0]);
			copyObj.key = 'All funds';
			copyObj.idx = i++;
			dataDict[k]['All ledgers'] = [copyObj];
		})

		return new Promise( (resolve, reject) => {
			return resolve(dataDict);
		});
	}

}


exports.getInvoiceData = function (params) {
/*runs query on postgres backend to filter results by ledger/fund parameter and to roll up the results by date */
/* returns a thenable to the server function */

	// The default position
	if (params.ledger == 'All ledgers' && params.fund == 'All funds') {
		
		return pgDb.any(queries.inv_stat_date_all, [params.fiscalPeriod]);

	}
	// a particular fund has been selected
	else if (params.fund != 'All funds') { 
	// need to filter the invoice table on "PARENT_FUND," not "FUND_NAME," since invoices are captured at the reporting level	

		return pgDb.any({text: queries.inv_stat_date_fund,
						values: [params.ledger, params.fund, params.fiscalPeriod]});
		
	}

	// a particular ledger has been selected
	else {
		
		return pgDb.any({text: queries.inv_stat_date_ledg,
						values: [params.ledger, params.fiscalPeriod]});
	}

}

exports.postProcess = function (data, total) {
/*helper function to convert the cumulative total spent into a debit against the total allocation  */	
	return data.map( (d) => {
		d.key = d.inv_date;
		d.value = total - +d.cumsum;
		return d;
	});
}
 


