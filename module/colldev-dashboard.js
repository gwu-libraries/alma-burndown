//Version 2. July 20, 2016. Re-writing with an object for each dataset.
// Initializing the object will perform the requisite queries.
"use strict"
var pgp = require('pg-promise')(),
	queries = require('./queries.json');


//initialize PG database connection
var pgDb = pgp(queries.connection);

// define column names as constants for ease of adjustment later
const amount = 'amount',
	fAlloc = 'fund_allocation',
	lAlloc = 'ledger_allocation',
	leKey = 'ledger_name',
	fuKey = 'fund_name',
	dateFields = ['invoice_status_date', 'invoice_date'],
	pathName = './public/data/';

var exports = module.exports = {};

//using ES6 classes for clarity
exports.LedgersFunds = class {
/*Runs query to populate the dataset of menu options. Stores in memory for speed of lookup.*/

	constructor(dataDict) {
		Object.keys(dataDict).forEach((k) => {
			this[k] = dataDict[k]; 				// cycle through the dict of men items and add them to the obj's properties
		}, this);

		return this;
	}

	static loadData(options) {
		/*using static method to load data prior to intialization
		see http://stackoverflow.com/questions/24398699/is-it-bad-practice-to-have-a-constructor-function-return-a-promise*/
		//acceptions option parameter = fiscal year
		if (arguments.length > 0) {
			let fiscalYear = arguments[0];
		
		//returns a thenable with the data object created from the query results. This ensures that the LedgersFunds instance won't be initialized until the query has been completed.
		return pgDb.any({text: queries['ledgersWithParam'],
					values: [fiscalYear]})
			.then((data) => {
				return this.processData(data); 
				// this construction is necessary to preserve the class scope: http://stackoverflow.com/questions/34930771/why-is-this-undefined-inside-class-method-when-using-promises
			})
			.catch((e) => {
				console.log(e);
			});
		}
		else {
			return pgDb.any(queries['ledgers'])
				.then((data) => {
					return this.processData(data);
				})
				.catch((e) => {
					console.log(e);
				});
		}

	} 

	static processData (data) {
	/*Populates a dict-like object with the results of th query, with keys for quick look-up of ledgers and funds, each of which returns an object for consumption by D3 methods*/

		// the default value for all ledgers needs to contain the total across all ledgers/funds
		let dataDict = {};

		//stores the complete list of ledgers for the ledgers menu
		dataDict.ledgers = [{key: 'All ledgers', value: 0}];

		data.forEach((d) => {
			//each fund key gets assigned an object bearing its name and its total allocation
			 let fund = {key: d[fuKey], value: +d[fAlloc]};
			 dataDict[d[fuKey]] = fund;

			// if this is the first time seeing this ledger, assign its total and initialize the array of its associated funds
			if (!dataDict[d[leKey]]) {
				let ledger = {key: d[leKey], value: +d[lAlloc]};
				dataDict.ledgers.push(ledger);

				dataDict[d[leKey]] = [{key: 'All funds', value: +d[lAlloc]}, fund]; 

				dataDict.ledgers[0].value += +d[lAlloc]; // increment the default total (across all ledgers)
			}
			
			// each ledger key also returns a list of associated funds
			else dataDict[d[leKey]].push(fund); 
		});
		
		dataDict['All ledgers'] = [{key: 'All funds', value: dataDict.ledgers[0].value}];

		return dataDict;
	}

}


exports.getInvoiceData = function (params) {
/*runs query on postgres backend to filter results by ledger/fund parameter and to roll up the results by date */
/* returns a thenable to the server function */

	// The default position
	if (params.ledger == 'All ledgers' && params.fund == 'All funds') {
		
		return pgDb.any(queries.inv_stat_date_all);

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
	return data.map((d) => {
		d.key = d.inv_date;
		d.value = total - +d.cumsum;
		return d;
	});
}
 


