/* 

x axis: date as 
	transaction_date if (expenditure > 0) or (renewal_date is null)
	else renewal_date
y axis: amount 
line 1: last(allocation) - rsum(expenditure)
line 2: last(allocation) - rsum(expenditure + encumbrance)

*/
//d3 formatting function for currency to two decimal places
const dollars = d3.format('$,.2f');

// for testing
const summaryFund = "Main Collections";
const ledger = "gwgel2019103301 Collections";

function getFiscalDates(fiscalTable) {
/* Function extracts the dates for the current fiscal year from a table, i.e., an array of objects where each object contains the key "fiscal_year_start_date" and "fiscal_year_end_date"*/
	return ["fiscal_period_start_date", "fiscal_period_end_date"].map(d => {
		
		let fiscalDate = fiscalTable[0][d],
		// need to reformat because the string returned by OBIEE is not conducive to conversion to a Javascript
			fiscalYear = fiscalDate.slice(0, 4),
			fiscalMonth = fiscalDate.slice(4, 6),
			fiscalDay = fiscalDate.slice(6);

		return new Date(`${fiscalYear}-${fiscalMonth}-${fiscalDay}`);
	});

}

function parseAllocations(allocTable) {
	/* Parses a table showing allocation amounts by fund and parent fund into a nested object for ease of lookup. Assumes allocTable is an array of row objects, where the keys are column names*/
	return allocTable.reduce((prev, curr) => {
		let parent_fund_ledger_name = curr.parent_fund_ledger_name;
		if (!prev.hasOwnProperty(parent_fund_ledger_name)) {
			// initialize a new nested object if this is the first time through
			prev[parent_fund_ledger_name] = {};
		}
		prev[parent_fund_ledger_name][curr.fund_ledger_name] = parseFloat(curr.transaction_allocation_amount);
		return prev;
	}, {});

}


// line factory for creating d3.line functions 
function lineFactory (xFunc, yFunc, valueKey) {
	/* xFunc and yFunc should be d3 scale functions, where x is a datetime scale and y a linear scale. Assumes the function returned will be used to create a path from an array of objects, where each object has this structure -- as created by d3.nest.entries -- with one or more key-value pairs nested under the "value" key: 			
				{key: date,
				value: {valueKey1: ...,
						valueKey2: ...}}  */

	return d3.line()
           		.x(function (d) { 
           			//console.log(`${new Date(d.key)}: ${xFunc(new Date(d.key))}`)
                	return xFunc(new Date(d.key));
            	})
          		.y(function (d) {
	                //console.log(`${d.value[valueKey]}: ${yFunc(d.value[valueKey])}`);
	                if (d.value[valueKey]) return yFunc(d.value[valueKey]);
    	        });
}

function filterData(data, fund, parentFund) {
	/* Filters the data to include only transactions corresponding to the selected fund */
	return data.filter(d => {
			return (d.fund_ledger_name == fund) &
					(d.parent_fund_ledger_name == parentFund)
			});
}

function rollupData(data, allocation, fiscalDates) {
 /* Rolls up the item-level data by date, sorting by date and summing the expenditures and encumbrances by that date, then creating a rolling balance, based on an original allocation. As used below, d3.nest.rollup produces an array of objects having the following structure:
	{key: ....,
	value: {valueKey1: ....,
			valueKey2: ...}
	}
Finally, this function shaves off transaction outside the current fiscal period.

  */
	let nest = d3.nest()
				.key(d => d.transaction_date)
				.sortKeys(d3.ascending)
				.rollup(leaves => { 
					return {actuals: d3.sum(leaves, d => parseFloat(d.transaction_expenditure_amount)),
							encumbrances: d3.sum(leaves, d => parseFloat(d.transaction_encumbrance_amount))
							};
				}),	
	
		nestedData = nest.entries(data);
	// Find the index of the node with the last non-zero value for expenditures ==> Do this before creating the rolling sum, so that we can use it to prune the expenditure line to the actual spend
	let lastExpIx = nestedData.reduce((prev, curr, i) => {
			if (curr.value.actuals != 0) prev = i;
			return prev;
		}, 0);
	// create the rolling sums
	// The projected field holds the sum of actuals + encumbrances
	return nestedData.reduce((prev, curr, i) => {
  		if (i == 0) {
  			curr.value.projected = allocation - (curr.value.encumbrances + curr.value.actuals);
  			curr.value.encumbrances = allocation - curr.value.encumbrances;
  			curr.value.actuals = allocation - curr.value.actuals;
  		}
  		else {
    		curr.value.projected = prev[prev.length - 1].value.projected - (curr.value.encumbrances + curr.value.actuals);
			curr.value.encumbrances = prev[prev.length - 1].value.encumbrances  - curr.value.encumbrances;
    		// set the expenditure to null if we are past the last new expenditure
    		curr.value.actuals = (i <= lastExpIx) ? prev[prev.length - 1].value.actuals - curr.value.actuals : null;
  		}
  		prev.push(curr);
  		return prev;
	}, [])
		.filter(d => {
			// filter out nodes outside of the fiscal year --> doing this AFTER rolling up the sums, so that we count encumbrances with a renewal date from last year
			return ((new Date(d.key) >= fiscalDates[0]) &
				(new Date(d.key) <= fiscalDates[1]));
		});
}


function setupChart() {
	
	var margin = {top: 20, right: 20, bottom: 75, left: 120},
    	width = 1060 - margin.left - margin.right,
    	height = 600 - margin.top - margin.bottom;



	//amount = Y axis
	var y = d3.scaleLinear()
    		.range([height, 0]);

	//date of transaction (actual or expected) on the X
	var x = d3.scaleTime()
    		.range([0, width]);

	//initiatilze axes with d3 helper functions
	var yAxisFunc = d3.axisLeft(y)
				.tickSizeInner(-width)
    			.tickFormat(dollars);

	var xAxisFunc = d3.axisBottom(x);

	// two lines, one for the rolling balance based on expenditures, the other on encumbrances
	var linesObj = {actuals: lineFactory(x, y, 'actuals'),
					projected: lineFactory(x, y, 'projected')};

	// add the SVG element and axes
	var chart = d3.select("#chart").append("svg")
    			.attr("width", width + margin.left + margin.right)
    			.attr("height", height + margin.top + margin.bottom)
    			.append("g")
    			.attr("class", "chart")
    			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	chart.append('g')
        .attr('class', 'yaxis');

	chart.append('g')
        .attr('class', 'xaxis')
        .attr('transform', 'translate(0,' + height  + ')');

     // create the legend and data key
     
     let legend = d3.select("#legend")
		.append('svg')
		.attr('width', 500)
		.attr('height', 100)
		.append('g')
		.attr('class', 'legend')
		.attr('transform', 'translate(30, 0)');

	legend.append('path')
		.attr('class', 'actuals-line')
		.attr('d', d3.line()([[0, 15], [30, 15]]))


	legend.append('path')
		.attr('d', d3.line()([[0, 45], [30, 45]]))
		.attr('class', 'projected-line');

	legend.append('text')
			.attr('x', 35)
			.attr('y', 15)
			.text('Actual Spend')

	legend.append('text')
			.attr('x', 35)
			.attr('y', 45)
			.text('Projected Spend (Actual + Encumbrance)')
	
	

	return [x, y, yAxisFunc, xAxisFunc, linesObj];

}

function makeChartTitle(fiscalYear) {
	// add a page title
	d3.select("#title")
		.attr("class", "title")
		.text(`Collections Spend, Actual & Projected, for ${fiscalYear}`);
}

function updateDataKey (fund, ledger, data, allocation) {
/* Updates the data key for the chart shown. */

	// Get the last non-null value in the rolling expenditures, and the last value for the encumbrances, and subtract again from the allocation to get the actual amount
	let spendToDate = allocation - data.filter(d => (d.value.actuals)).pop().value.actuals,
		projectedSpend = allocation - data[data.length-1].value.projected;

	d3.selectAll(".key_cell").remove()

	d3.select("#data_key_row")
			.selectAll(".key_cell")
			.data([dollars(allocation), 
				dollars(spendToDate), 
				dollars(projectedSpend)])
			.enter()
			.append("td")
			.attr("class", "key_cell")
			.text(d => d);
}


function drawAxes(x, y, yAxisFunc, xAxisFunc, dateRange, maxAmount) {
	/*Draws the x and y axes. Accepts the d3 x and y scale functions (x is time series, y is linear float), as well as the d3 axis functions and range endpoints. Assumes the axis elements have already been created as "g" elements on the SVG space. dateRange should be an array of two Date objects. maxAmount should be a float.*/
	y.domain([0, maxAmount]);
	
	d3.select('.yaxis').call(yAxisFunc);

	x.domain(dateRange);

	var X = d3.select(".xaxis").call(xAxisFunc);

	// transform the X axis
	X.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-65)');
}


function drawLines(linesObj, data) {
	/* Appends path elements created from a data set. The linesObj should have the following structure:
		{lineName: lineFunc} 
	where lineName is the name of a line to be used as a class attribute, and lineFunc is the corresponding d3 line function to draw that line, based on the supplied data
		*/
	for (let key in linesObj) {
		// remove any existing line of that type
		d3.select(".chart").select(`.${key}-line`).remove();
		// append the new line of that type
		d3.select(".chart")
			.append("path")
			.attr("class", `${key}-line`)
			.datum(data)
			.attr("d", linesObj[key]);
	}
	
}

function makeChart(data, allocation, fiscalDates, chartArgs) {
	/* (Re)draws the chart with new data. Assumes data is a key-sorted nested object (from d3.nest.entries (see above). fiscalDates should be a 2-element array of  date objects, and allocation a float. chartArgs are returned by the setupChart function. */
	
	let [x, y, yAxisFunc, xAxisFunc, linesObj] = chartArgs;
	
	drawAxes(x, y, yAxisFunc, xAxisFunc, fiscalDates, allocation);

	drawLines(linesObj, data);

}

function makeDropDown(id, data) {
	/*Populates a Bootstrap dropdown with values in the data passed. Id should be the container element's id property. Data should be either the object returned by the parseAllocations function or one of its nested objects.*/

		//get the keys of the object
		let menuData = Object.keys(data);

		// Get the Bootstrap element that holds the menu items
		let menu = d3.select(`#${id} div[class*='dropdown'] div[class*='dropdown-menu']`);

		// populate the menu items
		let dropdownElements = menu.selectAll(".dropdown-item")
			.data(menuData)
			.enter()
			.append("button")
			.attr("class", "dropdown-item")
			.property("type", "button")
			.text(d => d);	

		return dropdownElements;
}

// get the data, using the D3 fetch-based API's
Promise.all([d3.csv('./data/sum_fund_item_level.csv'),
			d3.csv('./data/sum_fund_allocation.csv'),
			d3.csv('./data/fiscal_periods.csv')])
	.then(data => {
		let [itemTable, allocTable, fiscalTable]  = data;
		// set up the chart space
		let chartArgs = setupChart();
		// get the start date for the fiscal year -- assuming that the fiscalTable data is sorted with the current fiscal year in the first row
		let fiscalDates = getFiscalDates(fiscalTable);
		// Create the title of the graph with the fiscal year
		makeChartTitle(fiscalTable[0].fiscal_period_description);
		// create the lookup object for allocation totals
		let allocLookup = parseAllocations(allocTable); 
		// initialize the data to a particular fund and filter out values not in this fiscal year
		let filteredData = filterData(itemTable, summaryFund, ledger);
		let rolledData = rollupData(filteredData, 
									allocLookup[ledger][summaryFund],
									fiscalDates);
		makeChart(rolledData, 
				allocLookup[ledger][summaryFund],
				fiscalDates,
				chartArgs);

		updateDataKey(summaryFund, ledger, rolledData, allocLookup[ledger][summaryFund]);

		// populate the ledger and fund menus
		let parentMenuItems = makeDropDown("parent_fund_ledger_name", allocLookup);

		// set up the event listener, taking advantage of closures for access to all the data
		parentMenuItems.on("click", d => {
				// select the child element by its id and remove the current options
				d3.select(`#fund_ledger_name div[class*='dropdown'] div[class*='dropdown-menu']`)
					.selectAll(".dropdown-item").remove();
				// set the text of the current (parent) menu to the selected option
				d3.select("#dropdown_parent_fund_ledger_name span")
					.text(d);
				d3.select("#dropdown_fund_ledger_name span")
					.text("Select a Fund");
				// call this function with the child menu id and data
				childMenuItems = makeDropDown("fund_ledger_name", allocLookup[d]);
				childMenuItems.on("click", dd => {
					// d is the datum from the parent menu's selected option, dd is from the child menu's selected option 
					d3.select("#dropdown_fund_ledger_name span")
						.text(dd);

					filteredData = filterData(itemTable, dd, d);
					rolledData = rollupData(filteredData, 
									allocLookup[d][dd],
									fiscalDates);

					makeChart(rolledData, 
								allocLookup[d][dd],
								fiscalDates,
								chartArgs);

					updateDataKey(dd, d, rolledData, allocLookup[d][dd]);

				});
			});
	

	})
	.catch(e => console.log(e));