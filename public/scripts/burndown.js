(function () {
//wrapped as function to avoid loading variables into the global browser namespace

//parameters for the SVG canvas
var margin = {top: 20, right: 20, bottom: 150, left: 120},
    width = 1060 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

//d3 formatting function for currency to two decimal places
var dollars = d3.format('$,.2f');

//amount = Y axis
var y = d3.scaleLinear()
    .range([height, 0]);

//status date (of invoice, etc.) on the X
var x = d3.scaleTime()
    .range([0, width]);

//initiatilze axes with d3 helper functions
var yAxis = d3.axisLeft(y)
    .tickFormat(dollars);

var xAxis = d3.axisBottom(x);

// initialize the svg space
var chart = d3.select("#chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// d3 line helper object
var line = d3.line()
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

	// TO DO: set up typeahead.js --> load dataset

	//initial AJAX call
	postData({ledger: 'All ledgers', fund: 'All funds'}, 'load');

}

function postData (params, dispatchEvent) {
/*Handles AJAX calls with server. User selections posted to server; received data passed to dispatcher functions 
	as determined by the dispatchEvent parameter*/
	var req = $.post('/burndown-data', params);

	req.done(function (body) {
		dispatch.call(dispatchEvent, this, body)
	});
}

dispatch.on('update.chart', function (body) {

	//the Y scale will change depending on the total allocated to a selected ledger or fund
	formatY(body.maxAlloc);
	
	//just pass the line helper function a new dataset
	d3.select(".solidLine")
      .attr("d", line(body.data));

});

dispatch.on('load.chart', function (body) {

	// initialize the axes
	formatX(body.data);
	formatY(body.maxAlloc);
	
	// draw the initial line on the chart
	drawLine(body.data, "solidLine");

});

function drawMenu (selection, options, classKey) {
/*This function sets up the menus initially, populating them with data from the server.
For menu options, key=string representing the ledger or fund, value=Boolean for disabling options with zero allocation*/

	var menuItems = selection.selectAll('option')
				.data(options, function (d) {
					return d.key;
				})				
				.enter()
				.append('option')
				.attr('class', classKey + 'Options')
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
			.attr('class', classKey + 'Options')
			.text(function (d) {
				return d.key;
			})
			.property('disabled', function (d) {
				return d.value <= 0;
			})
			.merge(menuItems);
}

dispatch.on("load.menus", function (body) {
/*Initialize each menu, including event handler triggered by user selection*/

	d3.select('#ledger')
				.append('select')
				.call(drawMenu, body.options.ledgers, 'ledger')
				.on('change', function () {
					d3.select('#fund select').property('value', 'All funds');
					postData({ledger: this.value, fund: 'All funds'}, 'update');
				});

	d3.select('#fund')
			.style('visibility', 'hidden')
			.append('select')
			.call(drawMenu, body.options.funds, 'fund')
			.on('change', function () {
				postData({ledger: d3.select('#ledger select').property('value'), fund: this.value}, 'update');
			});
});


dispatch.on('update.menus', function (body) {
/*Only ever need to update the fund menu options, which depend on the selected ledger. Ledger options don't change.*/
	
	if (d3.select('#ledger select').property('value') != 'All ledgers') {
		d3.select("#fund select")
			.style('visibility', 'visible')
			.call(updateMenu, body.options.funds, 'fund');
		}

	else {
		d3.select('#fund select').style('visibility', 'hidden');
	}
});


function drawLine (data, className) {
/*Initialize the path in the chart*/

	chart.append("path")
      .attr("class", className)
      .attr("d", line(data));

}

function formatY (maxAlloc) {

	// Y domain corresponds to maximum allocation per fund/ledger
	y.domain([0, maxAlloc]);

	d3.select('.yaxis').call(yAxis)

}

function formatX (data) {


	//called initially to set the endpoints of the time span on X
	x.domain(d3.extent(data.map(function (d) {
		return new Date(d.key);
	})));

	var axisX = d3.select(".xaxis").call(xAxis);

	axisX.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-65)');

}

}).call(this);


