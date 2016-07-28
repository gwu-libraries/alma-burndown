//Version 2. July 20, 2016. Re-writing with an object for each dataset.
// Initializing the object will perform the requisite queries.
"use strict"
var pgp = require('pg-promise')(),
	queries = require('./queries.json');

//initialize PG database connection
var pgDb = pgp(queries.connection);

// define column names as constants for ease of adjustment later
const amount = 'amount',
	fAll = 'fund_allocation',
	lAll = 'ledger_allocation',
	fComm = 'fund_commits',
	lComm = 'ledger_commits',
	leKey = 'ledger_name',
	fuKey = 'fund_name',
	fiP = 'fiscal_period_name',
	dateFields = ['invoice_status_date', 'invoice_date'],
	pathName = './public/data/';

var exports = module.exports = {};

exports.getFiscalPeriods = () => {
	return pgDb.any({text: queries['fiscal_periods']})
				.then( (data) => {
					return data.map( (d) => {
						// the key contains the name for menu display, the value > 0 turns on visibility, and the range is used for calculating start and end dates
						return {key: d.fiscal_period_name, value: 1, range: [d.fiscal_period_start, d.fiscal_period_end]};
					})
				})
				.catch( (err) => {
					console.log(err);
				})
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
		

		data.forEach( (d) => {
			//each fund key gets assigned an object bearing its name and its total allocation
			 
			if ( !dataDict[d[fiP]] ) {
				dataDict[d[fiP]] = {};
				dataDict[d[fiP]].ledgers = [{key: 'All ledgers', value: 0, commits: 0}];; // initialize the list of ledgers for this fiscal period
			}

			let thisObj = dataDict[d[fiP]],		// for ease of reference
				fund = {key: d[fuKey], value: +d[fAll], commits: +d[fComm]}; // data object for this fund

			// if this is the first time seeing this ledger, assign its total and initialize the array of its associated funds
			if ( !thisObj[d[leKey]] ) {
				let ledger = {key: d[leKey], value: +d[lAll], commits: +d[lComm]}; // data object for this ledger
				thisObj.ledgers.push(ledger);

				thisObj[d[leKey]] = [{key: 'All funds', value: +d[lAll], commits: +d[lComm]}, fund]; 

				thisObj.ledgers[0].value += +d[lAll]; // increment the default total (across all ledgers)
				thisObj.ledgers[0].commits += +d[lComm]; // increment the default total (across all ledgers)
			}
			
			// each ledger key returns a list of associated funds
			else thisObj[d[leKey]].push(fund); 
		});
		
		Object.keys(dataDict).forEach( (k) => {
			dataDict[k]['All ledgers'] = [{key: 'All funds', value: dataDict[k].ledgers[0].value, commits: dataDict[k].ledgers[0].commits}];
		})

		return new Promise( (resolve, reject) => {
			return resolve(dataDict);
		});
	}

}


exports.getInvoiceData = function (params, fiscalPeriod) {
/*runs query on postgres backend to filter results by ledger/fund parameter and to roll up the results by date */
/* returns a thenable to the server function */

	// The default position
	if (params.ledger == 'All ledgers' && params.fund == 'All funds') {
		
		return pgDb.any(queries.inv_stat_date_all, [fiscalPeriod]);

	}
	// a particular fund has been selected
	else if (params.fund != 'All funds') { 
	// need to filter the invoice table on "PARENT_FUND," not "FUND_NAME," since invoices are captured at the reporting level	

		return pgDb.any({text: queries.inv_stat_date_fund,
						values: [params.ledger, params.fund]});
		
	}

	// a particular ledger has been selected
	else {
		
		return pgDb.any({text: queries.inv_stat_date_ledg,
						values: [params.ledger]});
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
 


