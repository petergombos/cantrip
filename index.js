var _ = require("lodash");
var fs = require('fs');
var crypto = require('crypto');

module.exports = function cantrip(options) {
	
	options = options || {};

	options = _.extend({
		idAttribute: "_id", //Specifies what key should be used as id,
		shallow: false //Specifies whether objects should return with all nested objects or just the first layer
	}, options);

	/**
	 * This dataStore object is the interface through which you can access the raw data of cantrip.
	 * It is exposed on the returned middleware, so you can access its methods through it using cantrip.get() etc.
	 * @type {Object}
	 */
	var dataStore = require('./lib/dataStore')(options);

	/**
	 * This method is the one that handles the request
	 */
	var handle = function(req, res, next) {

		if (req.method === "GET") {
			get(req, res, next);
		} else if (req.method === "POST") {
			post(req, res, next);
		} else if (req.method === "PUT") {
			put(req, res, next);
		} else if (req.method === "PATCH") {
			put(req, res, next, true);
		} else if (req.method === "DELETE") {
			del(req, res, next);
		}
	};


	var get = function(req, res, next) {
		var targetNode = dataStore.get(req.path);
		if (_.isNull(targetNode)) {
			return next({
				status: 404,
				error: "Requested node doesn't exist."
			})
		}
		if (_.isObject(targetNode) || _.isArray(targetNode)) {
			res.body = _.cloneDeep(targetNode);

			//If the shallow parameter is set, only pass back the first layer of data
			if (options.shallow || req.query.shallow) {
				if (_.isObject(targetNode) && !_.isArray(targetNode)) {
					for (var key in res.body) {
						if (_.isObject(res.body[key]) && !_.isArray(res.body[key])) {
							res.body[key] = "[object Object]";
						}
						if (_.isArray(res.body[key])) {
							res.body[key] = "[object Array]";
						}
					}
				} else if (_.isArray(targetNode)) {
					for (var i = 0; i < res.body.length; i++) {
						for (var key in res.body[i]) {
							if (_.isObject(res.body[i][key]) && !_.isArray(res.body[i][key])) {
								res.body[i][key] = "[object Object]";
							}
							if (_.isArray(res.body[i][key])) {
								res.body[i][key] = "[object Array]";
							}
						}
					}
				}
			}

			//Search on shallow data, if set. Can supply either a JSON object of keys and values or just a simple string
			if (req.query.q && _.isArray(targetNode)) {
				var json;
				try {
					json = JSON.parse(req.query.q);
				} catch(err) {
					json = false;
				}

				if (json) {

					for (var i = 0; i < res.body.length; i++) {
						var matching = true;
						for (var key in json) {
							if ((res.body[i][key] + "").indexOf(json[key]) === -1) {
								matching = false;
							}
						}
						if (!matching) {
							delete res.body[i]
						}
					}
					res.body = _.compact(res.body);

				} else {
					for (var i = 0; i < res.body.length; i++) {
						var matching = false;
						for (var key in res.body[i]) {
							if ((res.body[i][key] + "").indexOf(req.query.q) > -1) {
								matching = true;
							}
						}
						if (!matching) {
							delete res.body[i]
						}
					}
					res.body = _.compact(res.body);
				}

			}

			//Use orderBy, if set
			if (_.isArray(targetNode) && req.query.orderby) {
				var orderby = req.query.orderby + "";
				var reverse = false;
				if (orderby[0] === "-") {
					reverse = true;
					orderby = orderby.slice(1);
				}
				res.body = _.sortBy(res.body, function(item) {
					return item[orderby];
				});

				if (reverse) {
					res.body = res.body.reverse();
				}
			}

			//Use pagination, if set
			if (_.isArray(targetNode)) {
				if (req.query.offset) {
					res.body = res.body.slice(req.query.offset);
				}
				if (req.query.limit) {
					res.body = res.body.slice(0, req.query.limit);
				}
			}

			//Only return specific fields if set
			if (req.query.fields) {
				var fields = req.query.fields.split(",");
				if (_.isObject(targetNode) && !_.isArray(targetNode)) {
					for (var key in res.body) {
						if (fields.indexOf(key) === -1) {
							delete res.body[key];
						}
					}
				} else if (_.isArray(targetNode)) {
					for (var i = 0; i < res.body.length; i++) {
						for (var key in res.body[i]) {
							if (fields.indexOf(key) === -1) {
								delete res.body[i][key];
							}
						}
					}
				}
			}

			next();
		} else {
			res.body = {
				value: targetNode
			};
			next();
		}
	};
	var post = function(req, res, next) {
		var targetNode = dataStore.get(req.path);
		if (_.isNull(targetNode)) {
			return next({
				status: 404,
				error: "Requested node doesn't exist."
			});
		}
		//If it's an array, post the new entry to that array
		if (_.isArray(targetNode)) {
			//Add ids to all objects within arrays in the sent object
			addMetadataToModels(req.body);
			//If the posted body is an object itself, add an id to it
			if (_.isObject(req.body) && !_.isArray(req.body)) {
				//Extend the whole object with an _id property, but only if it doesn't already have one
				var baseObject = {
					_createdDate: (new Date()).getTime(),
					_modifiedDate: (new Date()).getTime()
				};
				baseObject[options.idAttribute] = crypto.createHash('sha1').update((new Date()).valueOf().toString() + Math.random().toString()).digest('hex');
				req.body = _.extend(baseObject, req.body);
			}
			//Check if the given ID already exists in the collection
			for (var i = 0; i < targetNode.length; i++) {
				if (targetNode[i][options.idAttribute] === req.body[options.idAttribute]) {
					return next({
						status: 400,
						error: "An object with the same " + options.idAttribute + " already exists in this collection."
					});
				}
			}
			//Push it to the target array
			dataStore.set(req.path, req.body, false);
			//Set response
			res.body = _.cloneDeep(req.body);
			return next();

		} else {
			return next({
				status: 400,
				error: "Can't POST to a resource. Use PUT instead."
			});
		}
	};
	var put = function(req, res, next, patch) {
		var targetNode = dataStore.get(req.path);
		if (_.isNull(targetNode)) {
			return next({
				status: 404,
				error: "Requested node doesn't exist."
			})
		}
		if (_.isObject(targetNode) && !_.isArray(targetNode)) {
			addMetadataToModels(req.body);
			//If the target had previously had a _modifiedDate property, set it to the current time
			if (targetNode._modifiedDate) req.body._modifiedDate = (new Date()).getTime();

			var save = function() {
				dataStore.set(req.path, req.body, patch);
				//Set response
				res.body = {
					"success": true
				};
				return next();
			};
			//If it's an element inside a collection, make sure the overwritten _id is not present in the collection
			if (req.body[options.idAttribute] && targetNode[options.idAttribute] && req.body[options.idAttribute] !== targetNode[options.idAttribute]) {
				var parent = dataStore.parent(req.path)
				for (var i = 0; i < parent.length; i++) {
					if (parent[i][options.idAttribute] === req.body[options.idAttribute]) {
						return next({
							status: 400,
							error: "An object with the same " + options.idAttribute + " already exists in this collection."
						});
					}
				}
				//If there was no such problem
				save();
			} else {
				save();
			}
		} else {
			return next({
				status: 400,
				error: "Can't PUT a collection. Use POST instead."
			});
		}
	};
	var del = function(req, res, next) {
		//Check if the target node is existent
		var targetNode = dataStore.get(req.path);
		if (_.isNull(targetNode)) {
			return next({
				status: 404,
				error: "Requested node doesn't exist."
			});
		}
		//Get the parent node so we can unset the target
		var parent = dataStore.parent(req.path);
		//Last identifier in the path
		var index = _.last(req.path.split("/"));
		//If it's an object (not an array), then we just unset the key with the keyword delete
		if (_.isObject(parent) && !_.isArray(parent)) {
			//We're not letting users delete the _id
			if ((index + "")[0] === "_") {
				return next({
					status: 400,
					error: "You can't delete an object's metadata."
				});
			} else {
				dataStore.delete(req.path)
				//Set response
				res.body = {
					"success": true
				};
				return next();
			}
			//If it's an array, we must remove it by id with the splice method	
		} else if (_.isArray(parent)) {
			dataStore.delete(req.path)
			//Set response
			res.body = {
				"success": true
			};
			return next();
		}

	};
	//Recursively add _ids to all objects within an array (but not arrays) within the specified object.
	var addMetadataToModels = function(obj) {
		//Loop through the objects keys
		for (var key in obj) {
			//If the value of the key is an array (means it's a collection), go through all of its contents
			if (_.isArray(obj[key])) {
				for (var i = 0; i < obj[key].length; i++) {
					//Assign an id to all objects
					if (_.isObject(obj[key][i]) && !_.isArray(obj[key][i])) {
						var baseObject = {
							_createdDate: (new Date()).getTime(),
							_modifiedDate: (new Date()).getTime()
						};
						baseObject[options.idAttribute] = crypto.createHash('sha1').update((new Date()).valueOf().toString() + Math.random().toString()).digest('hex');
						obj[key][i] = _.extend(baseObject, obj[key][i]);
						//Modify the _modifiedDate metadata property
						obj[key][i]._modifiedDate = (new Date()).getTime();
					}
				}
				//If it's an object, call the recursive method with that object
			} else if (_.isObject(obj[key])) {
				addMetadataToModels(obj[key]);
			}
		}
	};

	handle.get = dataStore.get.bind(dataStore);
	handle.post = dataStore.set.bind(dataStore);
	handle.delete = dataStore.delete.bind(dataStore);
	handle.put = dataStore.set.bind(dataStore);
	
	return handle;
	
}

