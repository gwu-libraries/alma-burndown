var express = require('express'),
	app = express();

app.use(express.static('public'));

app.get('/', function (req, res) {
	res.send('Hello'_;
})
