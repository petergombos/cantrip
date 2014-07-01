var express = require('express');
var _ = require("lodash");
var fs = require('fs');
var md5 = require('MD5');
var cors = require('cors');
var bodyParser = require('body-parser');
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;



//Set up express
var app = express();
app.use(bodyParser.json());
app.use(function(err, req, res, next) {
	res.status(400);
	res.send({
		"error": "Invalid JSON supplied in request body."
	});
	next(err);
});
app.use(bodyParser.urlencoded());
//app.use(express.multipart());
app.use(cors());



var Cantrip = {
	options: {
		ip: "127.0.0.1",
		port: process.env.PORT || 3000,
		saveEvery: 1,
		file: "data.json"
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

		//Set up memory by reading the contents of the file
		if (!fs.existsSync(this.options.file)) {
			fs.writeFileSync(this.options.file, "{}");
		}

		// this.data = fs.readFileSync(this.options.file, {
		// 	encoding: 'utf-8'
		// });
		// this.data = JSON.parse(this.data);

		//Set up the server
		this.app = app;

		//Give access to the data object to middlewares
		app.use(function(req, res, next) {
			req.data = Cantrip.data;
			next();
		});

		//Get to the target node and save all nodes in between
		//Throws error if the requested node doesn't exist
		//app.use(this.nodes);

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

		var self = this;

		//Connect to mongo
		MongoClient.connect('mongodb://127.0.0.1:27017/cantrip', function(err, db) {
			if (err) throw err;
			self.data = db.collection('data');
			//Start the server
			self.server = self.app.listen(self.options.port, self.options.ip);
			self.onReady();
		});


	},
	onReady: function() {

	},
	/**
	 * Stop the server.
	 */
	close: function() {
		this.server.close();
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

	nodes: function(req, res, next) {
		//Parse the path and save it on the request
		req.pathMembers = _.filter(req.path.split("/"), function(string) {
			return string !== "";
		});
		var path = req.pathMembers;

		//Get the root element based on several factors: whether we have _contents in the JSON, did we try to access something inside a _meta parameter
		//By default the root is the whole JSON
		var route = Cantrip.data;
		//If we're trying to access a meta object
		if (path.length > 0 && path[0][0] === "_" && path[0] !== "_meta") {
			//Set the root object to that meta object, or throw an error if it doesn't exist
			if (Cantrip.data[path[0]] !== undefined) {
				route = Cantrip.data[path[0]];
				var metaObject = path.shift();
			} else {
				return next({
					status: 404,
					error: "Requested meta object doesn't exist."
				});
			}
			//If the first member of the url is "_meta", set the route root to Cantrip.data
		} else if (path[0] === "_meta") {
			route = Cantrip.data;
			var metaObject = path.shift();
			//If the first member of the url is not a meta object key, then check if we have _contents
		} else if (Cantrip.data._contents) {
			route = Cantrip.data._contents;
		}

		req.nodes = []; //This array holds all nodes until we get to the target node

		//Pass in the root ibject as the first node
		req.nodes.push(route);
		//Loop through the data by the given paths
		for (var i = 0; i < path.length; i++) {
			var temp = route[path[i]];
			//If we found the given key, assign the route object to its value
			if (temp !== undefined) {
				route = route[path[i]];
				//If the given key doesn't exist, try the _id
			} else {
				temp = _.find(route, function(obj) {
					return obj._id === path[i];
				});
				//If it's not undefined, then assign it as the value
				if (temp !== undefined) {
					route = temp;
				} else {
					return next({
						status: 404,
						error: "Requested node doesn't exist."
					});
				}
			}
			req.nodes.push(route);
		}

		//If the first member of the url was a _meta object, readd it to the beginning of the path array, so other middlewares still see the full path
		if (metaObject) {
			path.unshift(metaObject);
		}

		next();
	},
	//Save the JSON in memory to the specified JSON file. Runs after every API call, once the answer has been sent.
	//Uses the async writeFile so it doesn't interrupt other stuff.
	//If options.saveEvery is different from 1, it doesn't save every time.
	//If options.saveEvery is 0, it never saves
	counter: 0,
	syncData: function(req, res, next) {
		if (++Cantrip.counter === Cantrip.options.saveEvery && Cantrip.options.saveEvery !== 0) {
			fs.writeFile(Cantrip.options.file, JSON.stringify(Cantrip.data), function(err) {
				if (err) {
					console.log(err);
				}
			});
			Cantrip.counter = 0;
		}

	},
	addNode: function(path, value) {
		this.data.update({
			path: new RegExp(path)
		}, {
			value: value,
			path: path
		}, {
			upsert: true,
			safe: true
		}, function(err, docs) {
			err && console.log(err);
		});
	},
	/**
	 * Get a specific node as a JSON object from the db
	 * @param  {String} path
	 */
	getNode: function(path) {
		this.data.find({
			path: new RegExp(path)
		}, function(err, res) {
			err && console.log(err);
			res.toArray(function(err, array) {
				var result = {}; //This will hold the resulting object
				//Handle single ended queries, when all we return is a single value, an empty object or array
				if (array.length === 1) {
					if (array[0].value === "object") result = {};
					else if (array[0].value === "array") result = [];
					else result = { value: array[0].value }; //return a simple value: value object when the end result would be of a basic type
				}
				//Dig into the results. We loop through the nodes (objects) returned by the query
				for (var i = 0; i < array.length; i++) {
					var node = array[i]; //This is the current node in our json tree
					if (node.path.replace(path, "").substr(1) === "") {
						if (node.value === "array") result = []; //If the requested root node is an array, replace the base result variable with an empty array
						continue; //This is basically the first result. When we encounter it, we continue
					}
					var members = node.path.replace(path, "").substr(1).split("/"); //We omit the request path from the node's path attribute to get a relative reference, also strip the first / character
					var previousNode = null; //This is a pointer to the previous node
					var pointer = result; //This pointer will walk through our json object, searching for the place where the current node resides, so it can add a value to it
					//Loop through the nodes. foo/bar will become result.foo.bar
					for (var j = 0; j < members.length; j++) {
						previousNode = pointer; //This is a pointer to the previously checked node. Used for determining whether we're inside an array or an object
						if (j === members.length - 1) { //At the end of the pointer's walk, we add a value based on the node's value property
							if (node.value === "object") {
								if (_.isArray(previousNode)) previousNode.push({_id: members[j]});
								else pointer[members[j]] = {};
							} else if (node.value === "array") {
								if (_.isArray(previousNode)) previousNode.push([]);
								else pointer[members[j]] = [];
							} else {
								if (_.isArray(previousNode)) previousNode.push(node.value);
								else pointer[members[j]] = node.value;
							}
						} else {
							if (_.isArray(previousNode)) {
								//If the parent node was an array, we can't just use parent.current syntax, we need to find a member of the array by id (or index, in the case of simple arrays instead of collections)
								pointer = _.find(previousNode, function(obj) {
									return obj._id === members[j];
								});
							} else {
								//Set the pointer as parent.current
								pointer = pointer[members[j]];
							}
						}
					}
				}
				console.log(result);
			});
		});
	},
	get: function(req, res, next) {

		// var target = _.last(req.nodes);
		// if (_.isObject(target) || _.isArray(target)) {
		// 	res.body = _.cloneDeep(target);
		// 	next();
		// } else {
		// 	res.body = {
		// 		value: target
		// 	};
		// 	next();
		// }
	},
	post: function(req, res, next) {
		var target = _.last(req.nodes);
		//If it's an array, post the new entry to that array
		if (_.isArray(target)) {
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
			for (var i = 0; i < target.length; i++) {
				if (target[i]._id === req.body._id) {
					return next({
						status: 400,
						error: "An object with the same _id already exists in this collection."
					});
				}
			}
			//Push it to the target array
			target.push(req.body);
			//Send the response
			res.body = _.cloneDeep(req.body);
			next();
		} else {
			return next({
				status: 400,
				error: "Can't POST to an object. Use PUT instead."
			});
		}
	},
	put: function(req, res, next) {
		var target = _.last(req.nodes);
		if (_.isObject(target)) {
			Cantrip.addMetadataToModels(req.body);
			//If it's an element inside a collection, make sure the overwritten _id is not present in the collection
			if (req.body._id && target._id && req.body._id !== target._id) {
				var parent = req.nodes[req.nodes.length - 2];
				if (parent) {
					for (var i = 0; i < parent.length; i++) {
						if (parent[i]._id === req.body._id) {
							return next({
								status: 400,
								error: "An object with the same _id already exists in this collection."
							});
						}
					}
				}
			}
			//If the target had previously had a _modifiedDate property, set it to the current time
			if (target._modifiedDate) target._modifiedDate = (new Date()).getTime();
			target = _.extend(target, req.body);
			//Send the response
			res.body = _.cloneDeep(target);
			next();
		} else {
			return next({
				status: 400,
				error: "Can't PUT a collection."
			});
		}
	},
	delete: function(req, res, next) {
		//Get the parent node so we can unset the target
		var parent = req.nodes[req.nodes.length - 2];
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
				delete parent[index];
			}
			//If it's an array, we must remove it by id with the splice method	
		} else if (_.isArray(parent)) {
			//If the index is a number, index will be the actual index in the array
			if (_.isNumber(Number(index)) && !_.isNaN(Number(index))) {
				parent.splice(index, 1);
				//If it's a hash (string), we find the target object, get it's index and remove it from the array that way
			} else {
				var obj = _.find(parent, function(obj) {
					return obj._id === index;
				});
				parent.splice(_.indexOf(parent, obj), 1);
			}
		}
		//Send the response
		res.body = _.cloneDeep(parent || {});
		next();
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