var express = require('express');
var _ = require("lodash");
var fs = require('fs');
var md5 = require('MD5');
var cors = require('cors');
var bodyParser = require('body-parser')

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



var Cantrip = {
	options: {
		ip: "127.0.0.1",
		port: process.env.PORT || 3000,
		saveEvery: 1,
		namespace: "data"
	},
	/**
	 * The app's data should be accessed through this object's methods
	 * @type {Object}
	 */
	dataStore: {
		get: function(path, callback) {
			path = _.filter(path.split("/"), function(string) {
				return string !== "";
			});
			//Get the root element based on several factors: whether we have _contents in the JSON, did we try to access something inside a _meta parameter
			//By default the root is the whole JSON
			var node = Cantrip.data;
			//If we're trying to access a meta object
			if (path.length > 0 && path[0][0] === "_" && path[0] !== "_meta") {
				//Set the root object to that meta object, or throw an error if it doesn't exist
				if (Cantrip.data[path[0]] !== undefined) {
					node = Cantrip.data[path[0]];
					var metaObject = path.shift();
				} else {
					callback({
						status: 404,
						error: "Requested meta object doesn't exist."
					}, null);
					return;
				}
				//If the first member of the url is "_meta", set the node root to Cantrip.data
			} else if (path[0] === "_meta") {
				node = Cantrip.data;
				var metaObject = path.shift();
				//If the first member of the url is not a meta object key, then check if we have _contents
			} else if (Cantrip.data._contents) {
				node = Cantrip.data._contents;
			}

			//Loop through the data by the given paths
			for (var i = 0; i < path.length; i++) {
				var temp = node[path[i]];
				//If we found the given key, assign the node object to its value
				if (temp !== undefined) {
					node = node[path[i]];
					//If the given key doesn't exist, try the _id
				} else {
					temp = _.find(node, function(obj) {
						return obj._id === path[i];
					});
					//If it's not undefined, then assign it as the value
					if (temp !== undefined) {
						node = temp;
					} else {
						callback({
							status: 404,
							error: "Requested node doesn't exist."
						}, null);
						return;
					}
				}
			}

			callback(null, node);
		},
		set: function(path, data, callback) {
			this.get(path, function(err, target) {
				if (_.isArray(target)) {
					target.push(data);
				} else if (_.isObject(target)) {
					target = _.extend(target, data);
				} else {
					target = data;
				}
				callback();
			});
		},
		delete: function(path, callback) {
			var index = _.last(path.split("/"));
			this.parent(path, function(err, parent) {
				if (_.isArray(parent)) {
					if (_.isNumber(Number(index)) && !_.isNaN(Number(index))) {
						parent.splice(index, 1);
						//If it's a hash (string), we find the target object, get it's index and remove it from the array that way
					} else {
						var obj = _.find(parent, function(obj) {
							return obj._id === index;
						});
						parent.splice(_.indexOf(parent, obj), 1);
					}
				} else if (_.isObject(parent)) {
					delete parent[index];
				}
				callback();
			});
		},
		parent: function(path, callback) {
			this.get(path.split("/").slice(0, -1).join("/"), function(err, parent) {
				callback(err, parent);
			});
		}
	},
	/**
	 * Starts the server. Sets up the data in memory, creates a file if necessary
	 */
	start: function() {

		//Override options from command line arguments
		var self = this;
		process.argv.forEach(function(val, index, array) {
			if (val.indexOf("=") > -1) {
				var option = val.split("=");
				self.options[option[0]] = option[1];
			}
		});

		//Set up our persistence layer (JSON file or mongodb)
		this.setupPersistence();

		//Set up the server
		this.app = app;

		//Give access to the data object to middlewares and parse the request path for a helper array
		app.use(function(req, res, next) {
			req.data = Cantrip.data;
			//Parse the path and save it on the request
			req.pathMembers = _.filter(req.path.split("/"), function(string) {
				return string !== "";
			});
			next();
		});

		app.use(this.targetNode);

		//Set up middleware
		this.beforeMiddleware();

		//Handle errors thrown so far
		app.use(this.error);

		//Set default middleware
		app.get('*', this.get);

		app.post("*", this.post);

		app.delete("*", this.delete);

		app.put("*", this.put);

		//Call middleware that alter the response object
		this.alterMiddleware();

		//Handle errors thrown
		app.use(this.error);

		//Send the response
		app.use(this.response);

		//Set up 'after' middleware
		this.afterMiddleware();

		//Sync the data
		app.use(this.syncData);

		//Start the server
		this.server = this.app.listen(this.options.port, this.options.ip);

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
	 * By default this means reading a file and loading its contents as JSON into memory
	 */
	setupPersistence: function() {
		//Set up memory by reading the contents of the file
		if (!fs.existsSync("data/" + this.options.namespace + ".json")) {
			fs.writeFileSync("data/" + this.options.namespace + ".json", "{}");
		}

		this.data = fs.readFileSync("data/" + this.options.namespace + ".json", {
			encoding: 'utf-8'
		});

		this.data = JSON.parse(this.data);
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
			this.app.use.apply(this.app, this.beforeStack[i]);
		}

	},

	afterMiddleware: function() {
		for (var i = 0; i < this.afterStack.length; i++) {
			this.app.use.apply(this.app, this.afterStack[i]);
		}

	},

	alterMiddleware: function() {
		for (var i = 0; i < this.alterStack.length; i++) {
			this.app.use.apply(this.app, this.alterStack[i]);
		}
	},

	/**
	 * Gets the target node from the data. Throws an error if it doesn't exist
	 */
	targetNode: function(req, res, next) {
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
	syncData: function(req, res, next) {
		if (++Cantrip.counter === Cantrip.options.saveEvery && Cantrip.options.saveEvery !== 0) {
			fs.writeFile("data/" + Cantrip.options.namespace + ".json", JSON.stringify(Cantrip.data), function(err) {
				if (err) {
					console.log(err);
				}
			});
			Cantrip.counter = 0;
		}

	},
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
		res.send(res.body);
		next();
	}
}

module.exports = Cantrip;