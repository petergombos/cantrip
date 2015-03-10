var fs = require("fs");
_ = require("lodash");

module.exports =  function(options) {
	options = _.extend({
		file: "data/data.json"
	}, options);


	//Set up memory by reading the contents of the file
	if (!fs.existsSync(options.file)) {
		fs.writeFileSync(options.file, "{}");
	}

	var _data = JSON.parse(fs.readFileSync(options.file, {
		encoding: 'utf-8'
	}));

	/**
	 * Sync the data currently in memory to the target file
	 */
	function syncData() {
		fs.writeFile(options.file, JSON.stringify(_data, null, "\t"), function(err) {
			if (err) {
				console.log(err);
			}
		});
	}

	/**
	 * Return the datastore 
	 */
	return {
		get: function(path, callback) {
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
						return obj._id === path[i];
					});
					//If it's not undefined, then assign it as the value
					if (temp !== undefined) {
						node = temp;
					} else {
						if (callback && typeof callback === "function") callback(new Error("Requested node doesn't exist."));
						return null;
					}
				}
			}
			if (callback && typeof callback === "function") callback(null, node);
			return node;
		},
		set: function(path, data, patch, callback) {
			var target = this.get(path);
			if (_.isArray(target)) {
				//POST
				target.push(data);
				if (callback && typeof callback === "function") callback(null, target);
				syncData();
				return target;
			} else if (_.isObject(target)) {
				//PATCH
				if (patch) {
					target = _.merge(target, data);
					syncData();
					if (callback && typeof callback === "function") callback(null, target);
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
					if (callback && typeof callback === "function") callback(null, parent);
					return parent;
				}
			} else {
				var parent = this.parent(path);
				parent[_.last(path.split("/"))] = data;
				syncData();
				if (callback && typeof callback === "function") callback(null, parent);
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
						return obj._id === index;
					});
					parent.splice(_.indexOf(parent, obj), 1);
				}
			} else if (_.isObject(parent)) {
				delete parent[index];
			}
			if (callback && typeof callback === "function") callback(null, parent);
			syncData();
			return parent;
		},
		parent: function(path, callback) {
			var parent = this.get(path.split("/").slice(0, -1).join("/"));
			var err = parent === null ? new Error("Requested node doesn't exist.") : null;
			if (callback && typeof callback === "function") callback(err, parent);
			return parent;
		}
	};
}