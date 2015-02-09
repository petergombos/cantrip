var express = require('express');
var _ = require("lodash");
var fs = require('fs');
var md5 = require('MD5');
var cors = require('cors');
var bodyParser = require('body-parser')
var jsonPersistence = require('cantrip-persistence-json');
var RoutePattern = require("route-pattern");

//Set up express
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

//Set up the special router
app.specialMWRouter = express.Router();
app.specialMWRouter.use(bodyParser.json());
app.specialMWRouter.use(function(err, req, res, next) {
	return next({
		status: 400,
		error: "Invalid JSON supplied in request body."
	});
});
app.specialMWRouter.use(bodyParser.urlencoded());
app.specialMWRouter.use(cors());

var Cantrip = {
	options: {
		port: process.env.PORT || 3000,
		saveEvery: 1,
		namespace: "data.json",
		persistence: jsonPersistence
	},
	/**
	 * The app's data should be accessed through this object's methods. Provided by the persistence layer
	 * @type {Object}
	 */
	dataStore: {
		get: function(){},
		set: function(){},
		delete: function(){},
		parent: function(){}
	},
	/**
	 * Starts the server. Sets up the data in memory, creates a file if necessary
	 */
	start: function(callback) {

		//Override options from command line arguments
		var self = this;
		process.argv.forEach(function(val, index, array) {
			if (val.indexOf("=") > -1) {
				var option = val.split("=");
				self.options[option[0]] = option[1];
			}
		});

		//Add the loaded persistence layer's methods to the Cantrip object
		_.extend(this, this.options.persistence);
		//Set up our persistence layer (JSON file or mongodb)
		var self = this;
		this.setupPersistence(function() {
			self.dataStore.data = self.data;

			//Set up the server
			self.app = app;


			//Give access to the data object to middlewares and parse the request path for a helper array
			app.use(function(req, res, next) {
				req.data = Cantrip.data;
				req.dataStore = Cantrip.dataStore;
				req.cantrip = self;
				//Parse the path and save it on the request
				req.pathMembers = _.filter(req.path.split("/"), function(string) {
					return string !== "";
				});
				next();
			});


			//Add a "send" middleware to all special middlewares. This should allow you to modify returned values on special middlewares supplied by acl, for example
			for (var i = 0; i < self.specialStack.length; i++) {
				app.specialMWRouter.use(self.specialStack[i], function(error, req, res, next) {
					if (error.status && error.error) {
						res.status(error.status).send({
							"error": error.error
						});
					} else {
						console.log(error);
						res.status(400).send({
							"error": "An unknown error happened."
						});
					}
				});
				app.specialMWRouter.use(self.specialStack[i], function(req, res) {
					res.send(res.body);
				});
			}

			//Use special middleware
			app.use("/", app.specialMWRouter);

			//Get the target node based on the request path
			app.use(self.targetNode);

			//Set up middleware
			self.beforeMiddleware();

			//Handle errors thrown so far
			app.use(self.error);

			//Set default middleware
			app.get('*', self.get);

			app.post("*", self.post);

			app.delete("*", self.delete);

			app.put("*", self.put);

			//Call middleware that alter the response object
			self.alterMiddleware();

			//Handle errors thrown
			app.use(self.error);

			//Send the response
			app.use(self.response);

			// self.afterMiddleware();

			//Start the server
			//Check if we have privateKey and certificate for https
			if (self.options.https) {
				var http = require("http");
				var https = require("https");
				var httpServer = http.createServer(app);
				var httpsServer = https.createServer(self.options.https, app);

				httpServer.listen(self.options.port || 3000);
				httpsServer.listen(self.options.https.port || 443);

				callback && callback();
			} else {
				self.server = self.app.listen(self.options.port || 3000, self.options.ip);
				callback && callback();
			}
		});

	},
	/**
	 * Stop the server.
	 */
	close: function() {
		this.server.close();
	},

	/**
	 * Sets up the persistence (file, database etc.) required for saving data.
	 * Also sets up the Cantrip.data attribute which holds functions for accessing the data directly
	 * Provided by the persistence layer
	 * By default this means reading a file and loading its contents as JSON into memory
	 */
	setupPersistence: function() {
		
	},


	beforeStack: [],
	/**
	 * Wrapper for express.use to be used before data insertion
	 */
	before: function() {
		for (var i = 0; i < arguments.length; i++) {
			if (_.isObject(arguments[i]) && arguments[i].registerMiddleware) {
				var middlewares = arguments[i].registerMiddleware;
				for (var j = 0; j < middlewares.length; j++) {
					this[middlewares[j][0]](middlewares[j][1], middlewares[j][2]);
				}
			}
		}
		this.beforeStack.push(arguments);
	},

	/**
	 * Alias for before
	 */
	use: function() {
		this.before.apply(this, arguments);
	},

	afterStack: [],

	after: function() {
		for (var i = 0; i < arguments.length; i++) {
			if (_.isObject(arguments[i]) && arguments[i].registerMiddleware) {
				var middlewares = arguments[i].registerMiddleware;
				for (var j = 0; j < middlewares.length; j++) {
					this[middlewares[j][0]](middlewares[j][1], middlewares[j][2]);
				}
			}
		}
		this.afterStack.push(arguments);

	},

	alterStack: [],

	alter: function() {
		for (var i = 0; i < arguments.length; i++) {
			if (_.isObject(arguments[i]) && arguments[i].registerMiddleware) {
				var middlewares = arguments[i].registerMiddleware;
				for (var j = 0; j < middlewares.length; j++) {
					this[middlewares[j][0]](middlewares[j][1], middlewares[j][2]);
				}
			}
		}
		this.alterStack.push(arguments);
	},

	beforeMiddleware: function() {

		for (var i = 0; i < this.beforeStack.length; i++) {
			this.app.all.apply(this.app, this.beforeStack[i]);
		}

	},

	// @deprecated
	// afterMiddleware: function() {
	// 	for (var i = 0; i < this.afterStack.length; i++) {
	// 		this.app.use.apply(this.app, this.afterStack[i]);
	// 	}

	// },

	handleAfter: function(req, res) {
		var url = req.url;
		url = url.replace("/_contents", "");

		for (var i = 0; i < this.afterStack.length; i++) {
			var pattern = RoutePattern.fromString(this.afterStack[i][0]);
			if (pattern.matches(url)) {
				req.params = pattern.match(url).namedParams;
				this.afterStack[i][1](req, res, function() {});
			}
		}
	},

	alterMiddleware: function() {
		for (var i = 0; i < this.alterStack.length; i++) {
			this.app.all.apply(this.app, this.alterStack[i]);
		}
	},

	/**
	 * This stack is used for storing all special urls, so a response.send middleware can be added after the application has started
	 * @type {Array}
	 */
	specialStack : [],

	/**
	 * Register special middleware that shouldn't go through the normal middleware stack
	 */
	special: function() {
		//Add its route to the special Stack, so it can be referenced later
		this.specialStack.push(arguments[0]);
		for (var i = 0; i < arguments.length; i++) {
			if (_.isObject(arguments[i]) && arguments[i].registerMiddleware) {
				var middlewares = arguments[i].registerMiddleware;
				for (var j = 0; j < middlewares.length; j++) {
					this[middlewares[j][0]](middlewares[j][1], middlewares[j][2]);
				}
			}
		}
		app.specialMWRouter.use.apply(app.specialMWRouter, arguments);
	},

	/**
	 * Gets the target node from the data. Throws an error if it doesn't exist
	 */
	targetNode: function(req, res, next) {
		//Set _contents as the base path if there is no _meta route specified
		if (req.path[1] !== "_") {
			var current = req.path;
			//Redefine getter
			Object.defineProperty(req, 'path', {
			    get: function() {
			        return "/_contents" + current;
			    },
			    configurable: true
			});
		}
		//You can access the actual root if you specify the route /_meta
		else if (req.path.indexOf("/_meta") === 0) {
			var current = req.path;
			//Redefine getter
			Object.defineProperty(req, 'path', {
			    get: function() {
			        return current.replace("_meta", "");
			    },
			    configurable: true
			});
		}
		Cantrip.dataStore.get(req.path, function(error, data) {
			if (error) {
				return next(error);
			}
			req.targetNode = data;
			next();
		});
	},
	//Save the JSON in memory to the specified JSON file. Runs after every API call, once the answer has been sent.
	//Uses the async writeFile so it doesn't interrupt other stuff.
	//If options.saveEvery is different from 1, it doesn't save every time.
	//If options.saveEvery is 0, it never saves
	counter: 0,
	get: function(req, res, next) {
		if (_.isObject(req.targetNode) || _.isArray(req.targetNode)) {
			res.body = _.cloneDeep(req.targetNode);
			next();
		} else {
			res.body = {
				value: req.targetNode
			};
			next();
		}
	},
	post: function(req, res, next) {
		//If it's an array, post the new entry to that array
		if (_.isArray(req.targetNode)) {
			//Add ids to all objects within arrays in the sent object
			Cantrip.addMetadataToModels(req.body);
			//If the posted body is an object itself, add an id to it
			if (_.isObject(req.body) && !_.isArray(req.body)) {
				//Extend the whole object with an _id property, but only if it doesn't already have one
				req.body = _.extend({
					_id: md5(JSON.stringify(req.body) + (new Date()).getTime() + Math.random()),
					_createdDate: (new Date()).getTime(),
					_modifiedDate: (new Date()).getTime()
				}, req.body);
			}
			//Check if the given ID already exists in the collection
			for (var i = 0; i < req.targetNode.length; i++) {
				if (req.targetNode[i]._id === req.body._id) {
					return next({
						status: 400,
						error: "An object with the same _id already exists in this collection."
					});
				}
			}
			//Push it to the target array
			Cantrip.dataStore.set(req.path, req.body, function() {
				//Send the response
				res.body = _.cloneDeep(req.body);
				next();

			});
		} else {
			return next({
				status: 400,
				error: "Can't POST to an object. Use PUT instead."
			});
		}
	},
	put: function(req, res, next) {
		if (_.isObject(req.targetNode) && !_.isArray(req.targetNode)) {
			Cantrip.addMetadataToModels(req.body);
			//If the target had previously had a _modifiedDate property, set it to the current time
			if (req.targetNode._modifiedDate) req.body._modifiedDate = (new Date()).getTime();
			var save = function() {
				Cantrip.dataStore.set(req.path, req.body, function(err, status) {
					//Send the response
					res.body = {
						"success": true
					};
					next();
				});
			};
			//If it's an element inside a collection, make sure the overwritten _id is not present in the collection
			if (req.body._id && req.targetNode._id && req.body._id !== req.targetNode._id) {
				Cantrip.dataStore.parent(req.path, function(err, parent) {
					req.parentNode = parent;
					for (var i = 0; i < parent.length; i++) {
						if (parent[i]._id === req.body._id) {
							return next({
								status: 400,
								error: "An object with the same _id already exists in this collection."
							});
						}
					}
					//I there was no such problem
					save();
				});
			} else {
				save();
			}
		} else {
			return next({
				status: 400,
				error: "Can't PUT a collection."
			});
		}
	},
	delete: function(req, res, next) {
		//Get the parent node so we can unset the target
		Cantrip.dataStore.parent(req.path, function(err, parent) {
			//Last identifier in the path
			var index = _.last(req.pathMembers);
			//If it's an object (not an array), then we just unset the key with the keyword delete
			if (_.isObject(parent) && !_.isArray(parent)) {
				//We're not letting users delete the _id
				if ((index + "")[0] === "_") {
					return next({
						status: 400,
						error: "You can't delete an object's metadata."
					});
				} else {
					Cantrip.dataStore.delete(req.path, function() {
						//Send the response
						res.body = {
							"success": true
						};
						next();
					});
				}
				//If it's an array, we must remove it by id with the splice method	
			} else if (_.isArray(parent)) {
				Cantrip.dataStore.delete(req.path, function() {
					//Send the response
					res.body = {
						"success": true
					};
					next();
				});
			}

		});
	},
	//Recursively add _ids to all objects within an array (but not arrays) within the specified object.
	addMetadataToModels: function(obj) {
		//Loop through the objects keys
		for (var key in obj) {
			//If the value of the key is an array (means it's a collection), go through all of its contents
			if (_.isArray(obj[key])) {
				for (var i = 0; i < obj[key].length; i++) {
					//Assign an id to all objects
					if (_.isObject(obj[key][i]) && !_.isArray(obj[key][i])) {
						obj[key][i] = _.extend({
							_id: md5(JSON.stringify(obj[key][i]) + (new Date()).getTime() + Math.random()),
							_createdDate: (new Date()).getTime(),
							_modifiedDate: (new Date()).getTime()
						}, obj[key][i]);
						//Modify the _modifiedDate metadata property
						obj[key][i]._modifiedDate = (new Date()).getTime();
					}
				}
				//If it's an object, call the recursive method with that object
			} else if (_.isObject(obj[key])) {
				this.addMetadataToModels(obj[key]);
			}
		}
	},

	/**
	 * Send the errors thrown by the get/post/put/delete middleware
	 */
	error: function(error, req, res, next) {
		if (error.status && error.error) {
			res.status(error.status).send({
				"error": error.error
			});
		} else {
			console.log(error);
			res.status(400).send({
				"error": "An unknown error happened."
			});
		}
	},

	/**
	 * Send the response created by the get/post/put/delete methods after it was modified by custom middleware
	 */
	response: function(req, res, next) {
		res.on("finish", function() {
			Cantrip.handleAfter(req, res);
		});
		res.send(res.body);
	}
}

module.exports = Cantrip;