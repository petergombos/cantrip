var express = require('express');
var _ = require("underscore");
var fs = require('fs');
var md5 = require('MD5');
var cors = require('cors');

var dataFile = "data.json";


// TODO Folder support
process.argv.forEach(function(val, index, array) {
	if (index === 2 && val !== undefined) {
		dataFile = val;
	}
});

// If the file dosen't exists creates an empty JSON
if (!fs.existsSync(dataFile)) {
		fs.writeFileSync(dataFile, "{}");
}

// File contents to memory
var data = fs.readFileSync(dataFile, {encoding: 'utf-8'});
data = JSON.parse(data);

var app = express();
app.configure(function(){
	app.use(cors());
	app.use(express.bodyParser());
});


//Listen on port 3000
app.listen(9000);

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


var Cantrip = {
	getPath : function() {
		return _.filter(this.request.route.params[0].split("/"), function(string) {
			return string !== "";
		});
	},
	getData : function(callback) {
		callback(data);
	},
	getTargetNode : function(data) {
		var path = this.path;
		var route = data;
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
    				this.response.status(404).send({"error": "Requested node doesn't exists."});
    				return;
    			}
    		}
    	}

    	return route;
	},
	getParentNode: function(data) {
		var path = this.path;
		var route = data;
		//Loop through the data by the given paths
    	for (var i = 0; i < path.length-1; i++) {
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
    				response.status(404).send({"error": "Requested node doesn't exists."});
    				return;
    			}
    		}
    	}

    	return route;
	},
	saveData : function(){
		fs.writeFile(dataFile, JSON.stringify(data), function(err) {
			if (err) {
				console.log(err);
			}
		});
	},
	get: function(request, response) {
		this.request = request;
		this.response = response;
		this.path = this.getPath();
		var self = this;
		this.getData(function(data) {
			var target = self.getTargetNode(data);
			if (_.isObject(target) || _.isArray(target)) {
				response.send(target);
			} else if (target) {
				response.send({value: target});
			}
		});
	},
	post: function(request, response) {
		this.request = request;
		this.response = response;
		this.path = this.getPath();
		var self = this;
		this.getData(function(data) {
			var target = self.getTargetNode(data);
			//var parent = self.getParentNode(data);
			//If it's an array, post the new entry to that array
			if (_.isArray(target)) {
				//Add ids to all objects within arrays in the sent object
				self.addIdsToModels(request.body);
				//If the posted body is an object itself, add an id to it
				if (_.isObject(request.body) && !_.isArray(request.body)) {
					//Extend the whole object with an _id property, but only if it doesn't already have one
					request.body = _.extend({
						_id : md5(JSON.stringify(request.body) + (new Date()).getTime() + Math.random() )
					}, request.body);
				}
				//Push it to the target array
				target.push(request.body);

				response.send(request.body);
				self.saveData();
			} else {
				response.status(400).send({"error": "Can't POST to an object. Use PUT instead."});
			}
		});
	},
	put: function(request, response) {
		this.request = request;
		this.response = response;
		this.path = this.getPath();
		var self = this;
		this.getData(function(data) {
			var target = self.getTargetNode(data);
			if (_.isObject(target)) {
				self.addIdsToModels(request.body);
				target = _.extend(target, request.body);
				response.send(target);
				self.saveData();
			} else {
				response.status(400).send({"error": "Can't PUT a collection."});
			}
		});
	},
	delete: function(request, response) {
		this.request = request;
		this.response = response;
		this.path = this.getPath();
		var self = this;
		this.getData(function(data) {
			//Get the parent node so we can unset the target
			var parent = self.getParentNode(data);
			//Last identifier in the path
			var index = _.last(self.path);
			//If it's an object (not an array), then we just unset the key with the keyword delete
			if (_.isObject(parent) && !_.isArray(parent)) {
				//We're not letting users delete the _id
				if (index === "_id") {
					response.status(400).send({"error": "You can't delete the id of an object."});
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
			self.saveData();
		});
	},
	addIdsToModels: function(obj) {
		for (var key in obj) {
			if ( _.isArray( obj[key] ) ) {
				for (var i = 0; i < obj[key].length; i++) {
					if ( _.isObject(obj[key][i]) && !_.isArray(obj[key][i]) ) {
						obj[key][i] = _.extend({
							_id : md5(JSON.stringify(obj[key][i]) + (new Date()).getTime() + Math.random() )
						}, obj[key][i]);
					}
				}
			} else if ( _.isObject( obj[key] ) ) {
				this.addIdsToModels( obj[key] );
			}
		}
	}
}

module.exports = Cantrip;