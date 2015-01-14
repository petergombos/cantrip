var cantrip = require("./index.js");
var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser')

/**
 * All options for cantrip and their default values are listed here.
 * You can overwrite all settings in the command line by passing parameters with a port=2000 like syntax
 */

/**
 * Switch the default persistence layer. Import your persistence module to add it
 * @type {Object}
 */
//cantrip.options.persistence = jsonPersistence;

/**
 * Create a https server too
 * @type {Object}
 */
// cantrip.options.https = {
// 	key: fs.readFileSync(process.env["HOME"] + '/.credentials/server.key', 'utf8'),
// 	cert: fs.readFileSync(process.env["HOME"] + '/.credentials/server.crt', 'utf8'),
// 	port: 443
// };
// 
// 

var app = express();
app.use(bodyParser.json());
app.use(function(err, req, res, next) {
	return next({
		status: 400,
		error: "Invalid JSON supplied in request body."
	});
});

app.use(bodyParser.urlencoded());
//app.use(express.multipart());
app.use(cors());

app.use(cantrip());

app.get("/", function(req, res, next) {
	res.body.foo = "bar";
	next();
});

app.use(function(req, res, next) {
	res.send(res.body);
});

app.use(function(err, req, res, next) {
	res.send(err);
});

app.listen(3000);

