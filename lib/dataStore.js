var _ = require("lodash");
var fs = require("fs-extra");

module.exports =  function(options) {
	options = _.extend({
		file: "data.json",
		saveFrequency: 1,
		indexing: false
	}, options);

	var lastSaved = 0;

	//If the specified file doesn't exist, we create an empty JSON object
	if (!fs.existsSync(options.file)) {
		fs.ensureFileSync(options.file);
		fs.writeFileSync(options.file, "{}");
	}

	var _data;

	var _indexes = {};

	try {
		_data = JSON.parse(fs.readFileSync(options.file, {
			encoding: 'utf-8'
		}));
	} catch (err) {
		console.error("Cantrip - Not valid JSON file: " + options.file);
		process.exit(5);
	}

	function clone(object) {
		return JSON.parse(JSON.stringify(object));
	};

	function createIndex(pathIdentifier, data) {
		if (_indexes[pathIdentifier]) return;
		_indexes[pathIdentifier] = [];
		for (var i = 0; i < data.length; i++) {
			_indexes[pathIdentifier][data[i][options.idAttribute]] = data[i];
		}
	}

	function resetIndex(pathIdentifier) {
		for (var key in _indexes) {
			if (key.indexOf(pathIdentifier) === 0) {
				delete _indexes[key];
			}
		}
	}


	/**
	 * Sync the data currently in memory to the target file
	 */
	function syncData() {

		if (options.saveFrequency === 0) return;
		console.log("Sync");
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
	 * Private function for getting the reference to the target node
	 */
	var _get = function(path) {
		path = _.filter(path.split("/"), function(string) {
			return string !== "";
		});
		var node = _data;
		//Loop through the data by the given paths
		for (var i = 0; i < path.length; i++) {
			//Check if we are looking up an item in an array
			if (_.isArray(node) && options.indexing) {
				//if indexing is on, create an index if it didn't exist before, and assign the reference to the node
				var pathIdentifier = "/" + path.slice(0, i).join("/");
				if (!_indexes[pathIdentifier]) {
					createIndex(pathIdentifier, node);
				}
				node = _indexes[pathIdentifier][path[i]];
			} else {
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
		}
		return node || null;
	};


	function getParentPath(path) {
		return path.split("/").slice(0, -1).join("/");
	}

	var _parent = function(path) {
		var parent = _get(getParentPath(path));
		var err = parent === null ? new Error("Requested node doesn't exist.") : null;
		return parent;
	};

	/**
	 * Return the datastore 
	 */
	return {
		/**
		 * Public getter function that returns a clone of the target node
		 */
		get: function(path) {
			return clone(_get(path));
		},
		set: function(path, data, patch) {
			var target = _get(path);
			if (_.isArray(target)) {
				//POST
				var ref = clone(data);
				target.push(ref);
				//If indexing is turned on, make sure to insert the new reference
				if (options.indexing) {
					if (!_indexes[path]) {
						createIndex(path, target);
					}
					_indexes[path][data[options.idAttribute]] = ref;
				}
				syncData();
				return clone(data);
			} else if (_.isObject(target)) {
				//PATCH
				if (patch) {
					target = _.merge(target, data, function(a, b) {
						if (_.isArray(a)) {
							return b;
						}
					});
					syncData();
					//Reset the matching indexes if it's turned on
					if (options.indexing) {
						resetIndex(path);
					}
					return clone(target);
				} else {
					//PUT
					var parent = _parent(path);
					var toPut = _.last(path.split("/"));
					if (toPut === "") {
						_data = clone(data);
						_index = {};
					} else {
						if (_.isArray(parent)) {
							var item = _.find(parent, function(item) {
								return item[options.idAttribute] === toPut;
							});
							//Delete all keys of the array
							for (var key in item) {
								if (key !== options.idAttribute && key !== "_modifiedDate" && key !== "_createdDate") {
									delete item[key];
								}
							}
							item = _.merge(item, clone(data));
						} else {
							parent[toPut] = clone(data);
						}
					}
					syncData();
					//Reset the matching indexes if it's turned on
					if (options.indexing) {
						resetIndex(path);
					}
					return clone(target);
				}
			} else {
				var parent = _parent(path);
				parent[_.last(path.split("/"))] = data;
				syncData();
				//Reset the matching indexes if it's turned on
				if (options.indexing) {
					resetIndex(path);
				}
				return clone(parent);
			}
		},
		delete: function(path) {
			var key = _.last(path.split("/"));
			var parent = _parent(path);
			if (_.isArray(parent)) {
				var obj;
				if (options.indexing) {
					var indexKey = path.split("/").slice(0, -1).join("/");
					var obj = _indexes[indexKey][key];
					delete _indexes[getParentPath(path)][key];
					resetIndex(path);
				} else {
					obj = _.find(parent, function(obj) {
						return obj[options.idAttribute] === key;
					});
				}
				parent.splice(_.indexOf(parent, obj), 1);
			} else if (_.isObject(parent)) {
				delete parent[key];
				if (options.indexing) {
					resetIndex(path);
				}
			}
			syncData();
			return clone(parent);
		},

		parent: function(path) {
			return clone(_parent(path));
		}
		
	};
}