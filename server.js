var express = require('express');
var _ = require("underscore");
var fs = require('fs');
var md5 = require('MD5');

var dataFile = "data.json";

process.argv.forEach(function(val, index, array) {
	if (index === 2 && val !== undefined) {
		dataFile = val;
		
	}
});

if (!fs.existsSync(dataFile)) {
	fs.writeFile(dataFile, "{}", function() {
	});
}

var app = express();
app.configure(function(){
  app.use(express.bodyParser());
});

//Check if the file exists

//Listen on port 3000
app.listen(3000);

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
		fs.readFile(dataFile, {encoding: 'utf-8'}, function(err,data){
			 if (!err){
			 	data = JSON.parse(data);
			 	callback(data);
			 } else {
			 	console.log(err);
			 }
		});
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
    				this.response.send("Requested node doesn't exist");
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
    				this.response.send("Requested node doesn't exist");
    				return;
    			}
    		}
    	}

    	return route;
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
				var newEntry = _.extend({
					_id : md5(JSON.stringify(request.body) + (new Date()).getTime() + Math.random() )
				}, request.body);
				target.push(newEntry);
				fs.writeFile(dataFile, JSON.stringify(data), function(err) {
					if (err) {
						console.log(err);
					} else {
						response.send(newEntry);
					}
				});
			} else {
				response.send("Whoops, cant post to an object. Use PUT instead");
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
				target = _.extend(target, request.body);
				fs.writeFile(dataFile, JSON.stringify(data), function(err) {
					if (err) {
						console.log(err);
					} else {
						response.send(target);
					}
				});
			} else {
				response.send("Whoops, cant put a collection.");
			}
		});
	},
	delete: function(request, response) {
		this.request = request;
		this.response = response;
		this.path = this.getPath();
		var self = this;
		this.getData(function(data) {
			var parent = self.getParentNode(data);
			var index = _.last(self.path);
			if (_.isObject(parent) && !_.isArray(parent)) {
				delete parent[index];
			} else if (_.isArray(parent)) {
				if (_.isNumber(Number(index)) && !_.isNaN(Number(index))) {
					parent.splice(index, 1);
				} else {
					console.log(index);
					var obj = _.find(parent, function(obj) {
	    				return obj._id === index;
	    			});
	    			console.log(_.indexOf(parent, obj));
	    			parent.splice(_.indexOf(parent, obj), 1);
				}
			}
			fs.writeFile(dataFile, JSON.stringify(data), function(err) {
				if (err) {
					console.log(err);
				} else {
					response.send(parent);
				}
			});
		});
	}
}

module.exports = Cantrip;