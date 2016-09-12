(function () {
//wrapped as function to avoid loading variables into the global browser namespace

//parameters for the SVG canvas
var margin = {top: 20, right: 20, bottom: 150, left: 120},
    width = 1060 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

//d3 formatting function for currency to two decimal places
var dollars = d3.format('$,.2f');

var menuOptions, // global object to hold ledger/fund data for menu & tabular display
	paramKeys = ['fiscalPeriod', // template object for AJAX parameters
				'ledger',
				'fund'];

//amount = Y axis
var y = d3.scaleLinear()
    .range([height, 0]);

//status date (of invoice, etc.) on the X
var x = d3.scaleTime()
    .range([0, width]);

//initiatilze axes with d3 helper functions
var yAxis = d3.axisLeft(y)
	.tickSizeInner(-width)
    .tickFormat(dollars);

var xAxis = d3.axisBottom(x);

// initialize the svg space
var chart = d3.select("#chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// d3 line helper object
var line = d3.line().curve(d3.curveStepAfter)
			.x(function (d) { 
				return x(new Date(d.key));
			})
			.y(function (d) {
				//computed value for the cumulative total spent per date
				return y(d.value);
			});

//event handler
var dispatch = d3.dispatch('load', 'update');

//add axes to chart space
chart.append('g')
        .attr('class', 'yaxis');

chart.append('g')
        .attr('class', 'xaxis')
        .attr('transform', 'translate(0,' + height  + ')');


window.onload = function () {

	//initial AJAX calls

	//get fiscal period and ledger/fund data
	var req = $.post('/ledger_data');

	req.done(function (body) {
		//console.log(body)
		menuOptions = body;
		drawMenusOnLoad();
		drawTableOnLoad();
	});
}

function postData (dispatchEvent, selected) {
/*Handles AJAX calls with server. User selections posted to server; received data passed to dispatcher functions 
	as determined by the dispatchEvent parameter*/
	var params = {};  // object to pass with parameter values to the server

	// if a fiscal period or ledger has been selected, send "all funds"
	if ( selected ) {
		params.fiscalPeriod = getSelected('fiscalPeriod').key; 
		
		params.ledger = ( selected == 'fiscalPeriod' ) ? 'All ledgers' : getSelected('ledger').key;

		params.fund = 'All funds';
	}
		
		//populate the params by getting the currently selected menu options
	else {
		params = paramKeys.reduce( function (prev, curr) {
			prev[curr] = getSelected(curr).key;
			return prev;
		}, params);
	}

	var req = $.post('/burndown-data', params);

	req.done(function (body) {
		//console.log(body)
		
		formatX(params); 		// need to reinitialize the X axis when a new fiscal period is selected
		
		dispatch.call(dispatchEvent, this, body, params)
	});
}

function setDefault () {
	//set the default text for the menus, using different language if the 'All' option has been selected
	d3.selectAll('option')
		.filter(function (d) {
			return (d.key == 'All funds') || (d.key == 'All ledgers');
		})
		.text(function (d) {
			if (d3.select(this).property('selected')) {
				return 'Select a ' + d3.select(this).attr('class');
			}
			else return d.key;
		});

}

function getSelected (classKey) {
	//helper function to return to the currently selected menu item
	var node = d3.selectAll('.' + classKey).filter(function (d) {
		return this.selected;
	});
	return node.datum();
}

function drawMenusOnLoad () {
/*Initialize each menu, including event handler triggered by user selection*/

	var fiscalPeriod = menuOptions.fiscalPeriods[0].key;

	d3.select('#fiscalPeriod')
		.append('select')
		.call(drawMenu, menuOptions.fiscalPeriods, 'fiscalPeriod')
		.on('change', function () {
			postData('update', 'fiscalPeriod');
		});

	d3.select('#ledger')
			.append('select')
			.call(drawMenu, menuOptions.ledgersFunds[fiscalPeriod].ledgers, 'ledger')
			.on('change', function () {
				postData('update', 'ledger');
			});

	d3.select('#fund')
			.style('visibility', 'hidden')
			.append('select')
			.call(drawMenu, menuOptions.ledgersFunds[fiscalPeriod]['All ledgers'], 'fund')
			.on('change', function () {
				postData('update');
			});

	postData('load');
}


dispatch.on('update.menus', function (body, params) {
	
	var thisMenu = menuOptions.ledgersFunds[params.fiscalPeriod];

	d3.select('#ledger select')
		.call(updateMenu, thisMenu.ledgers, 'ledger');

	if (params.ledger != 'All ledgers') {
		d3.select("#fund select")
			.style('visibility', 'visible')
			.call(updateMenu, thisMenu[params.ledger], 'fund');
		}

	else {
		d3.select('#fund select').style('visibility', 'hidden')
			.call(updateMenu, thisMenu[params.ledger], 'fund');
	}

	setDefault();
});

function drawMenu (selection, options, classKey) {
/*This function sets up the menus initially, populating them with data from the server.
For menu options, key=string representing the ledger or fund, value=Boolean for disabling options with zero allocation*/

	var menuItems = selection.selectAll('option')
				.data(options, function (d) {
					return d;
				})
				.enter()
				.append('option')
				.attr('class', classKey)
				.text(function (d) {
					return d.key;
				})
				.property('disabled', function (d) {
					return d.value <= 0;
				});

}

function updateMenu (selection, options, classKey) {
/*Updates the menus with new options, based on the user's selection*/
	
	var menuItems = selection.selectAll('option')
				.data(options, function (d) {
					return d.key;
				});

	menuItems.exit().remove();
	
	menuItems.enter()
			.append('option')
			.attr('class', classKey)
			.text(function (d) {
					return d.key;
			})
			.property('disabled', function (d) {
				return d.value <= 0;
			})
			.merge(menuItems);

}


dispatch.on('update.table', function (body, params) {

	var ledgerData = menuOptions.ledgersFunds[params.fiscalPeriod][params.ledger];

	d3.select('tbody')
		.call(updateTable, ledgerData);

});

function drawTableHeader (selection, columns) {

	selection.append('tr')
		.selectAll('th')
		.data(columns)
		.enter()
		.append('th')
		.text(function (d) {
			if (d == 'key') return 'FUND'
			else if (d == 'value') return 'ALLOCATION'
			else return d.toUpperCase();
		});

}

function drawTable (selection, data) {

	//var fiscalPeriod = getSelected('fiscalPeriod');

	//if (fiscalPeriod.value != 1) return;

	var columns = Object.keys(data[0]); 

	selection.selectAll('tr')
			.data(data, function (d) {
				return d.key;
			})
			.enter()
			.append('tr')
			.selectAll('td')
			.data(function (d) {
				return columns.map( function (c) {
					return d[c];
				});
			})
			.enter()
			.append('td')
			.text(function (d) {
				return d;
			});

}

function updateTable (selection, data) {
	
	var columns = Object.keys(data[0]),
		tableRows = selection.selectAll('tr')
				.data(data, function (d) {
					return d.key;
				});

		tableCells = tableRows.selectAll('td')
				.data(function (d) {
					return columns.map( function (c) {
						return d[c];
					});
				});

	tableRows.exit().remove();
	tableCells.exit().remove();

}

function drawTableOnLoad () {
	
	// for the initial table, just show the default "all funds for all ledgers" data
	// TO DO: Show the ledgers on init for a new fiscal period selection?

	var fiscalPeriod = getSelected('fiscalPeriod').key,
		data = menuOptions.ledgersFunds[fiscalPeriod]['All ledgers'],
		columns = Object.keys(data[0]);

	var table = d3.select('#table')
						.append('table')
		
		table.append('thead')
			.call(drawTableHeader, columns);
		
		table.append('tbody')
			.call(drawTable, data);


}

dispatch.on('load.chart', function (body) {

	// initialize the axes
	formatY(body.maxAlloc);

	// draw the initial line on the chart
	drawLine(body.data);	
	// draw the legend
	drawLegend();

});

dispatch.on('update.chart', function (body) {

	//the Y scale will change depending on the total allocated to a selected ledger or fund
	formatY(body.maxAlloc);
	
	//just pass the line helper function a new dataset
	updateLine(body.data);


});



function endPoints (data) {
// if the data is empty for this set, return a set with endpoints at the fiscal year boundaries
// returns the data flanked by two additional sets of points for extending the line to the beginning and end of the fiscal year
//need to fetch the allocation amount from the current fund (menu option)
	var fund = getSelected('fund'),
		fiscalPeriod = getSelected('fiscalPeriod'),
		yearStart = new Date(fiscalPeriod.range[0]),
		yearEnd = new Date(fiscalPeriod.range[1]);

	if (data.length == 0) {	
		return [[{key: yearStart, value:fund.value}, {key: yearEnd, value:fund.value - fund.commits}]];
	}
	else if (data.length == 1) {
		return [[{key: yearStart, value:fund.value}, data[0]], data, [data[0], {key: yearEnd, value: data[0].value - fund.commits}]];
	}
	else {
		var d0 = data[0],	// earliest date in the dateset
			d1 = data[data.length-1], // lastest date
			p0 = (new Date(d0.key) > yearStart) ? yearStart : d0.key, // is this after the fiscal year start?
			p1 = (new Date(d1.key) < yearEnd) ? yearEnd : d1.key; // is this before the fy end?

		return [[{key: p0, value: fund.value}, {key: d0.key, value: d0.value}], 
				data,
				[{key: d1.key, value: d1.value}, {key: p1, value: d1.value - fund.commits}]];
	}
}


function drawLine (data) {
/*Initialize the path in the chart*/

	var extendedData = endPoints(data);

	chart.selectAll(".line")
			.data(extendedData)
			.enter()
 			.append('path')
 			.attr("class", function (d, i) {
 				if (i == 1) {
 					return 'line mainLine';
 				}
 				else {
 					return 'line endLine';
 				}
 			})
      		.attr("d", function (d) {
      			return line(d)
      		});
}

function updateLine (data) {

	var extendedData = endPoints(data);

	var lines = chart.selectAll(".line");
	      
	lines.remove()

    chart.selectAll(".line")
    	.data(extendedData)
    	.enter()
 		.append('path')
 		.attr("class", function (d, i) {
 			if (i == 1) {
 				return 'line mainLine';
 			}
 			else {
 				return 'line endLine';
 			}
 		})
      	.attr("d", function (d) {
      		return line(d)
      	});

}

function formatY (maxAlloc) {

	// Y domain corresponds to maximum allocation per fund/ledger
	y.domain([0, maxAlloc]);

	d3.select('.yaxis').call(yAxis)

}

function formatX (params) {

	var fiscalPeriodData = menuOptions.fiscalPeriods.filter( function (f) {
			return f.key == params.fiscalPeriod;
		});

	//called initially to set the endpoints of the time span on X
	x.domain(fiscalPeriodData[0].range.map(function (d) {
					return new Date(d);
				}));

	var axisX = d3.select(".xaxis").call(xAxis);

	axisX.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-65)');

}

function drawLegend () {
	var legend = d3.select("#legend")
		.append('svg')
		.attr('width', 500)
		.append('g')
		.attr('class', 'legend')
		.attr('transform', 'translate(30, 0)');

	legend.append('path')
		.attr('d', d3.line()([[0, 15], [30, 15]]))
		.attr('class', 'line mainLine');

	legend.append('path')
		.attr('d', d3.line()([[0, 45], [30, 45]]))
		.attr('class', 'line endLine');

	legend.append('text')
			.attr('x', 35)
			.attr('y', 15)
			.text('Total Spent (by Invoice Approval Date)')

	legend.append('text')
			.attr('x', 35)
			.attr('y', 45)
			.text('Allocation + Commitment')
}

}).call(this);


