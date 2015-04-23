var _ = require("lodash");
var fs = require('fs');
var md5 = require('MD5');

module.exports = function cantrip(options) {
	
	options = options || {};

	options = _.extend({
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
			if (req.path === "/") {
				for (var key in res.body) {
					if (key[0] === "_") delete res.body[key];
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
			})
		}
		//If it's an array, post the new entry to that array
		if (_.isArray(targetNode)) {
			//Add ids to all objects within arrays in the sent object
			addMetadataToModels(req.body);
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
			for (var i = 0; i < targetNode.length; i++) {
				if (targetNode[i]._id === req.body._id) {
					return next({
						status: 400,
						error: "An object with the same _id already exists in this collection."
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
			if (req.body._id && targetNode._id && req.body._id !== targetNode._id) {
				var parent = dataStore.parent(req.path)
				for (var i = 0; i < parent.length; i++) {
					if (parent[i]._id === req.body._id) {
						return next({
							status: 400,
							error: "An object with the same _id already exists in this collection."
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
		//Get the parent node so we can unset the target
		var parent = dataStore.parent(req.path)
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
				addMetadataToModels(obj[key]);
			}
		}
	};

	handle.get = dataStore.get;
	handle.post = dataStore.post;
	handle.delete = dataStore.delete;
	handle.put = dataStore.put;
	
	return handle;
	
}

