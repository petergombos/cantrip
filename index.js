var express = require('express');
var _ = require("underscore");
var fs = require('fs');
var md5 = require('MD5');
var cors = require('cors');
var io = require("socket.io");

//Set up express
var app = express();
app.configure(function() {
	app.use(express.json());
	app.use(function(err, req, res, next) {
		res.status(400);
		res.send({
			"error": "Invalid JSON supplied in request body."
		});
		next(err);
	});
	app.use(express.urlencoded());
	app.use(express.multipart());
	app.use(cors());
});

//Set up a get hook on all paths
app.get('*', function(request, response) {
	Cantrip.get(request, response);
});

app.post("*", function(request, response) {
	if (Cantrip.validate(request, response))
		Cantrip.post(request, response);
});

app.delete("*", function(request, response) {
	Cantrip.delete(request, response);
});

app.put("*", function(request, response) {
	if (Cantrip.validate(request, response))
		Cantrip.put(request, response);
});

//The object that handles requests
function Request(request, response) {
	this.request = request;
	this.response = response;
	this.path = this.getPath();
};

Request.prototype.getPath = function() {
	return _.filter(this.request.route.params[0].split("/"), function(string) {
		return string !== "";
	});
};


var Cantrip = {
	options: {
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
			fs.writeFileSync(this.options.file, "{_contents: {}, _metadata:{root: {}}}");
		}

		this.data = fs.readFileSync(this.options.file, {
			encoding: 'utf-8'
		});
		this.data = JSON.parse(this.data);

		//Set up the server
		this.app = app;

		//Start the server
		var server = this.app.listen(this.options.port);

		//Start socket io service too
		this.io = io.listen(server);

	},
	/**
	 * Gets the contents of the JSON based on whether there's a _contents key or not
	 * @return {Object} The actual contents object
	 */
	getContents: function() {
		if (this.data._contents !== undefined) {
			return this.data._contents
		} else {
			return this.data;
		}
	},
	getTargetNode: function(request) {
		var path = request.path;
		var route = this.getContents();
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
					//If it's still undefined, return
					request.response.status(404).send({
						"error": "Requested node doesn't exists."
					});
					return;
				}
			}
		}

		return route;
	},
	getParentNode: function(request) {
		var path = request.path;
		var route = this.getContents();
		//Loop through the data by the given paths
		for (var i = 0; i < path.length - 1; i++) {
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
					//If it's still undefined, return
					request.response.status(404).send({
						"error": "Requested node doesn't exists."
					});
					return;
				}
			}
		}

		return route;
	},
	//Save the JSON in memory to the specified JSON file. Runs after every API call, once the answer has been sent.
	//Uses the async writeFile so it doesn't interrupt other stuff.
	//If options.saveEvery is different from 1, it doesn't save every time.
	//If options.saveEvery is 0, it never saves
	counter: 0,
	saveData: function() {
		if (++this.counter === this.options.saveEvery && this.options.saveEvery !== 0) {
			fs.writeFile(this.options.file, JSON.stringify(this.data), function(err) {
				if (err) {
					console.log(err);
				}
			});
			this.options.saveEvery = 0;
		}
	},
	get: function(request, response) {
		var req = new Request(request, response);
		var target = this.getTargetNode(req);
		if (_.isObject(target) || _.isArray(target)) {
			response.send(target);
		} else if (target) {
			response.send({
				value: target
			});
		}
	},
	post: function(request, response) {
		var req = new Request(request, response);
		var target = this.getTargetNode(req);
		//If it's an array, post the new entry to that array
		if (_.isArray(target)) {
			//Add ids to all objects within arrays in the sent object
			this.addIdsToModels(request.body);
			//If the posted body is an object itself, add an id to it
			if (_.isObject(request.body) && !_.isArray(request.body)) {
				//Extend the whole object with an _id property, but only if it doesn't already have one
				request.body = _.extend({
					_id: md5(JSON.stringify(request.body) + (new Date()).getTime() + Math.random())
				}, request.body);
			}
			//Push it to the target array
			target.push(request.body);
			this.io.sockets.emit("POST:/" + req.path, request.body);

			response.send(request.body);
			this.saveData();
		} else {
			response.status(400).send({
				"error": "Can't POST to an object. Use PUT instead."
			});
		}
	},
	put: function(request, response) {
		var req = new Request(request, response);
		var target = this.getTargetNode(req);
		if (_.isObject(target)) {
			this.addIdsToModels(request.body);
			target = _.extend(target, request.body);
			response.send(target);
			this.io.sockets.emit("PUT:/" + req.path, target);
			this.saveData();
		} else {
			response.status(400).send({
				"error": "Can't PUT a collection."
			});
		}
	},
	delete: function(request, response) {
		var req = new Request(request, response);
		//Get the parent node so we can unset the target
		var parent = this.getParentNode(req);
		//Last identifier in the path
		var index = _.last(this.path);
		//If it's an object (not an array), then we just unset the key with the keyword delete
		if (_.isObject(parent) && !_.isArray(parent)) {
			//We're not letting users delete the _id
			if (index === "_id") {
				response.status(400).send({
					"error": "You can't delete the id of an object."
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
		response.send(parent);
		this.io.sockets.emit("DELETE:/" + req.path, parent);
		this.saveData();
	},
	//Recursively add _ids to all objects within an array (but not arrays) within the specified object.
	addIdsToModels: function(obj) {
		//Loop through the objects keys
		for (var key in obj) {
			//If the value of the key is an array (means it's a collection), go through all of its contents
			if (_.isArray(obj[key])) {
				for (var i = 0; i < obj[key].length; i++) {
					//Assign an id to all objects
					if (_.isObject(obj[key][i]) && !_.isArray(obj[key][i])) {
						obj[key][i] = _.extend({
							_id: md5(JSON.stringify(obj[key][i]) + (new Date()).getTime() + Math.random())
						}, obj[key][i]);
					}
				}
				//If it's an object, call the recursive method with that object
			} else if (_.isObject(obj[key])) {
				this.addIdsToModels(obj[key]);
			}
		}
	},
	getMetadata: function() {
		if (this.data._metadata !== undefined) {
			return this.data._metadata;
		} else {
			return false;
		}
	},
	/**
	 * The wrapper method for validation. Creates a Request object, then checks if we have validation in our JSON.
	 * If we do, it runs the data through it, returning either true or false based on whether the data passed the test or not.
	 * If the JSON doesn't support validation, it automatically returns true.
	 * @param  {Object} request From Express
	 * @param  {Object} response From Express
	 * @return {boolean}
	 */
	validate: function(request, response) {
		var req = new Request(request, response);
		var validation = this.getValidation("root", req);
		if (validation) {
			return this.validateObject(request.body, validation, req);
		} else {
			return true;
		}
	},
	/**
	 * Gets a validation object from the metadata.
	 * @param  {String} typeName The name of the validation object. The ke "root" is special and signifies the whole JSON object
	 * @param  {Object} req      The Request object
	 * @return {Object}          Returns a validation object. If it doesn't exists, returns false.
	 */
	getValidation: function(typeName, req) {
		var metadata = this.getMetadata();
		if (metadata) {
			//When we check the root, we go through the metadata following the path.
			//When we use this function later to dig into another type in the schema, we just return that object
			if (typeName !== "root") {
				return metadata[typeName];
			}
			var validation = metadata[typeName];
			//go through the metadata following the path
			for (var i = 0; i < req.path.length; i++) {
				if (validation[req.path[i]] !== undefined) {
					validation = validation[req.path[i]];
					//if it's an object, get out of the current type and search for that type on the metadata root
					if (validation.type === "object") {
						validation = metadata[validation.name];
					} else if (validation.type === "collection") {
						validation = metadata[validation.model];
					}
				} else {
					//We are in a model inside a collection
					validation = validation;
				}
			}
			return validation;
		} else {
			return false;
		}
	},
	validateObject: function(object, validation, req) {
		//If object is not an object return error
		if (!_.isObject(object)) {
			req.response.status(400).send({
				"error": "Type error. Expected object, found "+object+"."
			});
			return false;
		}
		for (var key in object) {
			var v = validation[key];
			//return false if we try to validate a key that doesn't exist in the schema
			if (v === undefined) {
				req.response.status(400).send({
					"error": "Type error. Invalid key in object (" + key + ")."
				});
				return false;
			}
			//Check type
			if (!this.checkType(object[key], v, req)) {
				var correctType = v.type === "object" ? v.name : v.type;
				req.response.status(400).send({
					"error": "Type error. Key " + key + " must be of type " + correctType
				});
				return false;
			}
			//TODO egyéb validációk
		}
		return true;
	},
	checkType: function(value, validation, req) {
		var type = validation.type;
		if (type === "boolean") {
			if (_.isBoolean(value)) return true;
			else return false;
		} else if (type === "string") {
			if (_.isString(value)) return true;
			else return false;
		} else if (type === "number") {
			if (_.isNumber(value)) return true;
			else return false;
		} else if (type === "object") {
			console.log(validation.name, value, this.getValidation(validation.name, req));
			//If we specified a name, then the object must be of a given shema. If we didn't, its free for all!
			if (validation.name === undefined) return true;
			if (this.validateObject(value, this.getValidation(validation.name, req), req)) return true;
			else return false;
		} else if (type === "collection") {
			if (validation.model === undefined) return true;
			else {
				if (_.indexOf(["string", "number", "boolean"], validation.model) > -1) {
					var valid = true;
					for (var i = 0; i < value.length; i++) {
						if (!this.checkType(value[i], {
							type: validation.model
						}, req)) valid = false;
					}
					return valid;
				} else {
					var valid = true;
					for (var i = 0; i < value.length; i++) {
						if (!_.isObject(value[i])) valid = false;
						if (!this.validateObject(value[i], this.getValidation(validation.model, req), req)) valid = false;
					}
					return valid;
				}
			}
		}
	}
}

module.exports = Cantrip;