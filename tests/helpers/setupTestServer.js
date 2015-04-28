var express = require('express');
var bodyParser = require('body-parser');
var fs = require("fs");
var initialData = JSON.parse(fs.readFileSync(__dirname + "/../test.json"));
var _ = require("lodash");

var currentPort = 3001;

function getPortNumber() {
	return currentPort++;
}

module.exports = function(cantrip) {

	var port = getPortNumber();
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
		cantrip.put("/", _.cloneDeep(initialData));
	}

	app.url = "http://localhost:"+port+"/";

	return app;

}