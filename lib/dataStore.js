var _ = require("lodash");
var fs = require("fs-extra");

module.exports =  function(options) {

	options = _.extend({
		file: process.cwd() + "/data.json",
		saveFrequency: 1
	}, options);

	var lastSaved = 0;

	//If the specified file doesn't exist, we create an empty JSON object
	if (!fs.existsSync(options.file)) {
		fs.ensureFileSync(options.file);
		fs.writeFileSync(options.file, "{}");
	}

	var _data;

	try {
		_data = JSON.parse(fs.readFileSync(options.file, {
			encoding: 'utf-8'
		}));
	} catch (err) {
		console.error("Cantrip - Not valid JSON file: " + options.file);
		process.exit(5);
	}


	/**
	 * Sync the data currently in memory to the target file
	 */
	function syncData() {

		if (options.saveFrequency === 0) return;

		lastSaved++;

		if (lastSaved === options.saveFrequency) {
			fs.writeFile(options.file, JSON.stringify(_data, null, "\t"), function(err) {
				if (err) {
					console.log(err);
				}
			});
			lastSaved = 0;
		}

	}

	/**
	 * Return the datastore 
	 */
	return {
		get: function(path) {
			path = _.filter(path.split("/"), function(string) {
				return string !== "";
			});
			var node = _data;
			//Loop through the data by the given paths
			for (var i = 0; i < path.length; i++) {
				var temp = node[path[i]];
				//If we found the given key, assign the node object to its value
				if (temp !== undefined) {
					node = node[path[i]];
					//If the given key doesn't exist, try the _id
				} else {
					temp = _.find(node, function(obj) {
						return obj[options.idAttribute] === path[i];
					});
					//If it's not undefined, then assign it as the value
					if (temp !== undefined) {
						node = temp;
					} else {
						return null;
					}
				}
			}
			return node;
		},
		set: function(path, data, patch) {
			var target = this.get(path);
			if (_.isArray(target)) {
				//POST
				target.push(data);
				syncData();
				return target;
			} else if (_.isObject(target)) {
				//PATCH
				if (patch) {
					target = _.merge(target, data);
					syncData();
					return target;
				} else {
					//PUT
					var parent = this.parent(path);
					var toPut = _.last(path.split("/"));
					if (toPut === "") {
						_data = data;
					} else {
						parent[toPut] = data;
					}
					syncData();
					return parent;
				}
			} else {
				var parent = this.parent(path);
				parent[_.last(path.split("/"))] = data;
				syncData();
				return parent;
			}
		},
		delete: function(path, callback) {
			var index = _.last(path.split("/"));
			var parent = this.parent(path);
			if (_.isArray(parent)) {
				if (_.isNumber(Number(index)) && !_.isNaN(Number(index))) {
					parent.splice(index, 1);
					//If it's a hash (string), we find the target object, get it's index and remove it from the array that way
				} else {
					var obj = _.find(parent, function(obj) {
						return obj[options.idAttribute] === index;
					});
					parent.splice(_.indexOf(parent, obj), 1);
				}
			} else if (_.isObject(parent)) {
				delete parent[index];
			}
			syncData();
			return parent;
		},
		parent: function(path, callback) {
			var parent = this.get(path.split("/").slice(0, -1).join("/"));
			var err = parent === null ? new Error("Requested node doesn't exist.") : null;
			return parent;
		}
	};
}