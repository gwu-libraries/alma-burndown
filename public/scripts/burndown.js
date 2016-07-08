(function () {

var data,
	ledgerDict = {},
	fundDict = {},
	MAX_ALLOC = 0;




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
				return y(d.values.cumsum);
			});

var dispatch = d3.dispatch("load", "statechange");


chart.append('g')
        .attr('class', 'yaxis');

chart.append('g')
        .attr('class', 'xaxis')
        .attr('transform', 'translate(0,' + height  + ')');


window.onload = function () {

// AJAX call to load the initial data
	var req = $.get('/burndown-data');

	req.done(function (data) {
		
	});


}


		formatX(data);

		
		sumData1 = rollUpByDate(data, dateFields[0], 'AMOUNT', MAX_ALLOC);
		//sumData2 = rollUpByDate(data, dateFields[1], 'AMOUNT', MAX_ALLOC);
		formatY(MAX_ALLOC);
		//console.log(sumData)
		drawLine(sumData1, "solidLine");
		//drawLine(sumData2, "dashedLine")

		dispatch.load(); 
	});

});

dispatch.on('statechange.data', function (obj) {

	//console.log(obj.value)
	var filteredData,
		ledgerSelected,
		fundSelected,
		key,
		maxAlloc;

	// Condition one: fund menu changed, all funds selected: need to retrieve ledger
	if (obj.key == 'FUND_NAME' && obj.value == 'All funds') {
		ledgerSelected = d3.select('#ledger select')
							.property('value');
		if (ledgerSelected != 'All ledgers') {
			key == 'LEDGER_NAME';
			maxAlloc = ledgerDict[ledgerSelected].total;
		}
	}
	// Condition two: fund menu changed, specific fund selected; no need to worry about ledger
	else if (obj.key == 'FUND_NAME') {
		fundSelected = obj.value;
		key = 'PARENT_FUND';
		maxAlloc = fundDict[fundSelected];
	}	
	// Condition three: ledger menu changed; no need to worry about funds
	else if (obj.key == 'LEDGER_NAME' && obj.value != 'All ledgers') {
		ledgerSelected = obj.value;
		key = 'LEDGER_NAME';
		maxAlloc = ledgerDict[ledgerSelected].total;
	}
	// Condition four: all ledgers, all funds (default position, no filtering necessary)
	else key = null;

	// No need to filter on BOTH ledgers and funds, since funds belong to specific ledgers
	//replace with call to server function
	//if filtering, use local maxAlloc
	if (key) {
		filteredData = data.filter(function (d) {
			return d[key] == ((ledgerSelected) ? ledgerSelected : fundSelected);
		});
		sumData = rollUpByDate(filteredData, dateFields[0], 'AMOUNT', maxAlloc);
		updateChart(sumData, maxAlloc)
	}
	//if not filtering, use global maxAlloc
	else {
		sumData = rollUpByDate(data, dateFields[0], 'AMOUNT', MAX_ALLOC);
		updateChart(sumData, MAX_ALLOC);
	}

});

function updateChart(data, maxAlloc) {

	formatY(maxAlloc);
	
	d3.select(".solidLine")
      .attr("d", line(data));
}

function drawMenu (selection, options, className, testFunc) {
	
	selection.selectAll('option')
				.data(options)
				.enter()
				.append('option')
				.attr('class', className)
				.text(function (d) {
					return d;
				})
				.property('disabled', function (d) {
					return testFunc(d);
				});
}

dispatch.on("load.menus", function () {

	var ledgerOptions = ['All ledgers'].concat(d3.keys(ledgerDict)),
		fundOptions = ['All funds'].concat(d3.keys(fundDict)); 

	d3.select('#ledger')
				.append('select')
				.call(drawMenu, ledgerOptions, 'ledgerOption', function (d) {
						return (d == 'All ledgers' || ledgerDict[d].total > 0) ? false : true;
						})
				.on('change', function () {
					dispatch.statechange({key: 'LEDGER_NAME', value: this.value})
				});

	d3.select('#fund')
			.append('select')
			.call(drawMenu, fundOptions, 'fundOption', function (d) {
				return (d == 'All funds' || fundDict[d] > 0) ? false : true;	
			})
			.on('change', function () {
				dispatch.statechange({key: 'FUND_NAME', value: this.value})
			});
});

dispatch.on('statechange.menus', function (obj) {

	//Need only update the fund menu if what has changed is the ledger menu
	//console.log(obj.value)
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

	/*var extent = d3.extent(data.map(function (d) {
		return d[dateFields[1]];
	})),
		firstDate = d3.min([data[0][dateFields[0]], extent[0]]),
		lastDate = d3.max([data[data.length-1][dateFields[0]], extent[1]]);*/


	//var firstDate = data[0][dateFields[0]],
	//	lastDate = data[data.length-1][dateFields[0]];


	//x.domain([firstDate, lastDate]);

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

