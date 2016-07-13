(function () {

var margin = {top: 20, right: 20, bottom: 150, left: 120},
    width = 1060 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

var dollars = d3.format('$,.2f');

var y = d3.scaleLinear()
    .range([height, 0]);

var x = d3.scaleTime()
    .range([0, width]);

var yAxis = d3.axisLeft(y)
    .tickFormat(dollars);

var xAxis = d3.axisBottom(x);


var chart = d3.select("#chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


var line = d3.line()
			.x(function (d) { 
				//Necessary because the nest function automatically converts Dates to Strings when using them as keys
				return x(new Date(d.key));
			})
			.y(function (d) {
				//console.log(d)
				return y(d.value.cumsum);
			});

var dispatch = d3.dispatch('load', 'update');


chart.append('g')
        .attr('class', 'yaxis');

chart.append('g')
        .attr('class', 'xaxis')
        .attr('transform', 'translate(0,' + height  + ')');


window.onload = function () {

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

	formatY(body.maxAlloc);
	
	d3.select(".solidLine")
      .attr("d", line(body.data));

});

dispatch.on('load.chart', function (body) {

	//console.log(body)
	formatX(body.data);
	formatY(body.maxAlloc);
	
	drawLine(body.data, "solidLine");

});

function drawMenu (selection, options, classKey) {
	
	

	var menuItems = selection.selectAll('option')
				.data(options, function (d) {
					return d.key;
				})				.enter()
				.append('option')
				.attr('class', classKey + 'Options')
				.text(function (d) {
					return d.key;
				})
				.property('disabled', function (d) {
					return d.value;
				});
}

function updateMenu (selection, options, classKey) {
	
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
				return d.value;
			})
			.merge(menuItems);
}

dispatch.on("load.menus", function (body) {

	d3.select('#ledger')
				.append('select')
				.call(drawMenu, body.options.ledgers, 'ledger')
				.on('change', function () {
					postData({ledger: this.value, fund: 'All funds'}, 'update');
				});

	d3.select('#fund')
			.append('select')
			.call(drawMenu, body.options.funds, 'fund')
			.on('change', function () {
				postData({ledger: d3.select('#ledger select').property('value'), fund: this.value}, 'update');
			});
});

dispatch.on('update.menus', function (body) {

	
	d3.select("#fund select")
		.call(updateMenu, body.options.funds, 'fund');
		
});


function drawLine (data, className) {

	chart.append("path")
      .attr("class", className)
      .attr("d", line(data));

}

function formatY (maxAlloc) {

	
	y.domain([0, maxAlloc]);

	d3.select('.yaxis').call(yAxis)

}

function formatX (data) {

	x.domain(d3.extent(data.map(function (d) {
		return new Date(d.key);
	})));

	var axisX = d3.select(".xaxis").call(xAxis);

	// can we move this to the original axis set-up?
	axisX.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-65)');

}

}).call(this);


