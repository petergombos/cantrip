var express = require('express');
var bodyParser = require('body-parser');
var fs = require("fs");
var initialData = JSON.parse(fs.readFileSync(__dirname + "/../test.json"));
var _ = require("lodash");

var cantrip = require("../../index.js")({
	saveFrequency: 0,
	file: "../../test.json"
});

var port = 3001;
var app = express();
app.use(bodyParser.json());
app.use(function(err, req, res, next) {
	return next({
		status: 400,
		error: "Invalid JSON supplied in request body."
	});
});

app.use(cantrip);

app.use(function(err, req, res, next) {
if (err.status) res.status(err.status);
	res.send({
		error: err.error
	});
});

app.use(function(req, res, next) {
	res.send(res.body);
});


app.serverInstance = app.listen(port);

app.port = port;


app.resetData = function() {
	cantrip.set("/", _.cloneDeep(initialData));
}

app.url = "http://localhost:"+port+"/";

app.cantrip = cantrip;

module.exports = app;
