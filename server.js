var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var passport = require("passport");
var BearerStrategy = require("passport-http-bearer");


var cantrip = require("./index.js")();

var app = express();

passport.use("token", new BearerStrategy(function(token, done) {
	var user = cantrip.get("/_users/" + token)
	return done(null, user);
}));

app.use(bodyParser.json());
app.use(function(err, req, res, next) {
	return next({
		status: 400,
		error: "Invalid JSON supplied in request body."
	});
});


app.use(bodyParser.urlencoded());
app.use(cors());
app.use(passport.initialize());
app.use(passport.authenticate("token", {session:false}), function(req, res, next) {
	console.log("YAY");
	console.log(req.user);
	next();
});
app.use(function(req, res, next) {
	console.log("!!!", req.user);
	next();
})
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



