(function () {

var margin = {top: 20, right: 20, bottom: 150, left: 120},
    width = 1060 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

var dollars = d3.format('$,.2f');

var y = d3.scale.linear()
    .range([height, 0]);

var x = d3.time.scale()
    .range([0, width]);

var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left")
    .tickFormat(dollars);

var xAxis = d3.svg.axis()
    .scale(x)
    .orient('bottom');


var chart = d3.select("#chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


var line = d3.svg.line()
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

	postData({ledger: null, fund: null}, 'load');

}

function postData (params, dispatchEvent) {
/*Handles AJAX calls with server. User selections posted to server; received data passed to dispatcher functions 
	as determined by the dispatchEvent parameter*/
	var req = $.post('/burndown-data', prop);

	req.done(function (body) {
		var data = body.data,
			maxAlloc = body.maxAlloc
			options = body.options;

	
		dispatch.call(dispatchEvent, this, data, maxAlloc, options)
	});
}

dispatch.on('update.chart', function (data, maxAlloc, options) {

	formatY(maxAlloc);
	
	d3.select(".solidLine")
      .attr("d", line(data));

});

dispatch.on('load.chart', function (data, maxAlloc, options) {

	formatX(data);
	formatY(maxAlloc);
	
	drawLine(data, "solidLine");

});

function drawMenu (selection, options, className) {
	
	selection.selectAll('option')
				.data(options)
				.enter()
				.append('option')
				.attr('class', className)
				.text(function (d) {
					return d.key;
				})
				.property('disabled', function (d) {
					return d.value;
				});
}

dispatch.on("load.menus", function (data, maxAlloc, options) {

	d3.select('#ledger')
				.append('select')
				.call(drawMenu, options.ledgers, 'ledgerOption')
				.on('change', function () {
					dispatch.statechange({ledger: this.value, fund: null});
				});

	d3.select('#fund')
			.append('select')
			.call(drawMenu, options.funds, 'fundOption')
			.on('change', function () {
				dispatch.statechange({ledger: d3.select('#ledger select').property('value'), fund: this.value});
			});
});

dispatch.on('update.menus', function (data, maxAlloc, options) {

	
	if (obj.key == 'LEDGER_NAME') {
		var fundOptions = (obj.value == 'All ledgers') ? 
			['All funds'].concat(d3.keys(fundDict)) : 
			['All funds'].concat(ledgerDict[obj.value].funds);
		
		d3.selectAll(".fundOption").remove();

		d3.select("#fund select")
					.call(drawMenu, fundOptions, 'fundOption', function (d) {
						return (d == 'All funds' || fundDict[d] > 0) ? false : true;
					});
	} 
		
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
		return d[dateFields[0]];
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


