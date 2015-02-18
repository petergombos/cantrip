var express = require('express');
var _ = require("lodash");
var fs = require('fs');
var md5 = require('MD5');
var cors = require('cors');
var bodyParser = require('body-parser')
var jsonPersistence = require('cantrip-persistence-json');
var RoutePattern = require("route-pattern");

module.exports = function cantrip(options, callback) {

	options = _.extend({
		file: "data/data.json",
		persistence: jsonPersistence
	}, options);

	options.persistence(options, function(err, dataStore) {

		if (err) {
			return callback && typeof callback === 'function' && callback(err);
		}

		/**
		 * This method handles the request
		 */
		var handle = function(req, res, next) {
			targetNode(req, res, next, function() {
				if (req.method === "GET") {
					get(req, res, next);
				} else if (req.method === "POST") {
					post(req, res, next);
				} else if (req.method === "PUT") {
					put(req, res, next);
				} else if (req.method === "DELETE") {
					del(req, res, next);
				}
			});
		};

		/**
		 * Gets the target node from the data. Throws an error if it doesn't exist
		 */
		var targetNode = function(req, res, next, callback) {
			dataStore.get(req.path, function(error, data) {
				if (error) {
					return next(error);
				}
				req.targetNode = data;
				callback();
			});
		};
		var get = function(req, res, next) {
			if (_.isObject(req.targetNode) || _.isArray(req.targetNode)) {
				res.body = _.cloneDeep(req.targetNode);
				next();
			} else {
				res.body = {
					value: req.targetNode
				};
				next();
			}
		};
		var post = function(req, res, next) {
			//If it's an array, post the new entry to that array
			if (_.isArray(req.targetNode)) {
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
				for (var i = 0; i < req.targetNode.length; i++) {
					if (req.targetNode[i]._id === req.body._id) {
						return next({
							status: 400,
							error: "An object with the same _id already exists in this collection."
						});
					}
				}
				//Push it to the target array
				dataStore.set(req.path, req.body, function() {
					//Set response
					res.body = _.cloneDeep(req.body);
					next();

				});
			} else {
				return next({
					status: 400,
					error: "Can't POST to an object. Use PUT instead."
				});
			}
		};
		var put = function(req, res, next) {
			if (_.isObject(req.targetNode) && !_.isArray(req.targetNode)) {
				addMetadataToModels(req.body);
				//If the target had previously had a _modifiedDate property, set it to the current time
				if (req.targetNode._modifiedDate) req.body._modifiedDate = (new Date()).getTime();
				var save = function() {
					dataStore.set(req.path, req.body, function(err, status) {
						//Set response
						res.body = {
							"success": true
						};
						return next();
					});
				};
				//If it's an element inside a collection, make sure the overwritten _id is not present in the collection
				if (req.body._id && req.targetNode._id && req.body._id !== req.targetNode._id) {
					dataStore.parent(req.path, function(err, parent) {
						req.parentNode = parent;
						for (var i = 0; i < parent.length; i++) {
							if (parent[i]._id === req.body._id) {
								return next({
									status: 400,
									error: "An object with the same _id already exists in this collection."
								});
							}
						}
						//I there was no such problem
						save();
					});
				} else {
					save();
				}
			} else {
				return next({
					status: 400,
					error: "Can't PUT a collection."
				});
			}
		};
		var del = function(req, res, next) {
			//Get the parent node so we can unset the target
			dataStore.parent(req.path, function(err, parent) {
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
						dataStore.delete(req.path, function() {
							//Set response
							res.body = {
								"success": true
							};
							return next();
						});
					}
					//If it's an array, we must remove it by id with the splice method	
				} else if (_.isArray(parent)) {
					dataStore.delete(req.path, function() {
						//Set response
						res.body = {
							"success": true
						};
						return next();
					});
				}

			});
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
		
		callback && callback(null, handle);
	});
	
}

