var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');

require("./index.js")(function(err, cantrip) {

	var app = express();
	app.use(bodyParser.json());
	app.use(function(err, req, res, next) {
		return next({
			status: 400,
			error: "Invalid JSON supplied in request body."
		});
	});

	app.use(bodyParser.urlencoded());
	app.use(cors());

	app.use(cantrip);

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

});


