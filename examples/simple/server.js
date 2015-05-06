/**
 * Example of a simple cantrip server binding to a data.json file. 
 * It's not a real life example, and its main purpose is just to demonstrate various ways to modify cantrip's basic behaviour.
 */

var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var _ = require("lodash");

//Initialize a cantrip instance with the data.json in this directory
var cantrip = require("../../index.js")({
    file: __dirname + '/data.json'
});

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(function(err, req, res, next) {
    return next({
        status: 400,
        error: "Invalid JSON supplied in request body."
    });
});

//Save the time of the request
app.use(function(req, res, next) {
    cantrip.set("/", {
        lastRequest: new Date().getTime()
    }, true); //Use true as the third parameter in cantrip.set if you want patch-like behavior and not put
    next();
});

//Log all non-GET requests
app.use(function(req, res, next) {
	if (req.method === "GET") {
		return next();
	}
	cantrip.set("/log", {
		endpoint: req.path,
		method: req.method,
		payload: req.body,
		date: new Date().getTime()
	});
	next();
});

// Make sure a todo has text field and send back an error if it doesn't.
// Also make sure it has a completed field
app.post("/todos", function(req, res, next) {

    if (!req.body.text || !_.isString(req.body.text)) {
        return res.status(400).send({
            error: "You must specify valid a text field."
        });
    }

    req.body = _.merge({
        completed: false
    }, req.body);
    next();
});

//An example endpoint that doesn't use cantrip at all
app.get("/hello", function(req, res, next) {
	res.send({
		"hello": "world"
	});
	//Note that we don't call next
});

//Get the number of items in our todo list
app.get("/count", function(req, res) {
	var items = cantrip.get("/todos");
	res.send({
		count: items.length
	});
});


//Now comes the normal cantrip behavior
app.use(cantrip);

//Sometimes you want to modify the response that cantrip gives you. You can do these in middlewares *after* cantrip.
//For example, we don't want to send the todo notes when asking for the whole array
app.get("/todos", function(req, res, next) {
	res.body = res.body.map(function(item) {
		delete item.notes;
		return item;
	});
	next();
});

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