var express = require('express');
var _ = require("underscore");
var fs = require('fs');
var md5 = require('MD5');
var cors = require('cors');



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
	Cantrip.post(request, response);
});

app.delete("*", function(request, response) {
	Cantrip.delete(request, response);
});

app.put("*", function(request, response) {
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
			fs.writeFileSync(this.options.file, "{}");
		}

		this.data = fs.readFileSync(this.options.file, {
			encoding: 'utf-8'
		});
		this.data = JSON.parse(this.data);

		//Set up the server
		this.app = app;

		//Start the server
		this.app.listen(this.options.port);
	},
	getTargetNode: function(request) {
		var path = request.path;
		var route = this.data;
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
		var route = this.data;
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
	}
}

module.exports = Cantrip;