var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var cantrip = require("../../index.js");

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(function(err, req, res, next) {
	return next({
		status: 400,
		error: "Invalid JSON supplied in request body."
	});
});

app.use(cantrip({
	file : __dirname + '/data.json'
}));

app.use(function(req, res, next) {
	res.send(res.body);
});

app.use(function(err, req, res, next) {
	if (err.status) res.status(err.status);
	res.send({
		error: err.error
	});
});

app.listen(3000);
