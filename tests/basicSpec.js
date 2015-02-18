var request = require("request");
var express = require('express');
var bodyParser = require('body-parser');
require("../index.js")({
	file: "data/test" + Math.floor(Math.random() * 10000000000) + ".json"
}, function(err, cantrip) {
	//Set up
	var app = express();
	app.use(bodyParser.json());
	app.use(function(err, req, res, next) {
		return next({
			status: 400,
			error: "Invalid JSON supplied in request body."
		});
	});

	app.use(bodyParser.urlencoded());

	app.use(cantrip);

	app.use(function(err, req, res, next) {
		if (err.status) res.status(err.status);
		res.send({
			error: err.error
		});
	});

	app.use(function(req, res, next) {
		res.send(res.body);
	});


	app.listen(3001);

	var serverUrl = "http://localhost:3001/";

	describe("Cantrip is a connect/express middleware creating a REST API mapping for any JSON file", function() {

		it("should initialize", function() {
			expect(cantrip).toBeDefined();
		});

		describe("Basic REST API functions", function() {

			describe("PUT", function() {

				it("should allow you to put the root object, overwriting it", function(done) {
					request({
						method: "PUT",
						url: serverUrl,
						json: {
							foo: "bar"
						}
					}, function(error, response, body) {
						expect(body).toEqual({
							success: true
						});
						cantrip.get("/", function(err, data) {
							expect(data).toEqual({
								foo: "bar"
							});
							done();
						});
					});
				});

				it("should allow you to overwrite previous values", function(done) {
					request({
						method: "PUT",
						url: serverUrl,
						json: {
							foo: {
								string: "some string",
								soonToBeRemoved: 3
							}
						}
					}, function(error, response, body) {
						expect(body).toEqual({success: true});
						cantrip.get("/foo", function(err, data) {
							expect(data).toEqual({
								string: "some string",
								soonToBeRemoved: 3
							});
							done();
						});
					});
				});

				it("should allow you to put children, and overwrite whole objects", function(done) {
					request({
						method: "PUT",
						url: serverUrl + "foo",
						json: {
							collection: []
						}
					}, function(error, response, body) {
						expect(body).toEqual({success: true});
						cantrip.get("/foo", function(err, data) {
							expect(data).toEqual({
								collection: []
							});
							done();
						});
					});
				});

				it("should have all modifications up until now saved", function(done) {
					request({
						method: "GET",
						url: serverUrl,
						json: true
					}, function(error, response, body) {
						expect(body).toEqual({
							foo: {
								collection: []
							}
						});
						done();
					});
				});

			});

			describe("POST", function() {

				it("should throw an error when posting to something other than a collection", function(done) {
					request({
						method: "POST",
						url: serverUrl,
						json: {
							"foo": "bar"
						}
					}, function(error, response, body) {
						expect(body.error).toBeDefined();
						done();
					});
				});

				it("should allow you to post to a collection and generate you an id, and the _createdDate and _modifiedDate metadata", function(done) {
					request({
						method: "POST",
						url: serverUrl + "foo/collection",
						json: {
							"foo": "bar"
						}
					}, function(error, response, body) {
						expect(body.foo).toEqual("bar");
						expect(body._id).toBeDefined();
						expect(body._createdDate).toBeDefined();
						expect(body._modifiedDate).toBeDefined();
						done();
					});
				});

				it("should allow you to post to a collection with a specific id and not overwrite it", function(done) {
					request({
						method: "POST",
						url: serverUrl + "foo/collection",
						json: {
							"foo": "bar",
							"_id": "imanid"
						}
					}, function(error, response, body) {
						expect(body._id).toEqual("imanid");
						done();
					});
				});

				it("shouldn't allow you to post to a collection with a specific id that already exists", function(done) {
					request({
						method: "POST",
						url: serverUrl + "foo/collection",
						json: {
							"foo": "bar",
							"_id": "imanid"
						}
					}, function(error, response, body) {
						expect(body.error).toBeDefined();
						done();
					});
				});

				it("shouldn't allow you to put the _id attribute of an element in a collection if that change would make that _id not unique", function(done) {
					request({
						method: "PUT",
						url: serverUrl + "foo/collection/0",
						json: {
							"_id": "imanid"
						}
					}, function(error, response, body) {
						expect(body.error).toBeDefined();
						done();
					});
				});

				it("should allow you to post to a collection with a specific _modifiedDate and not overwrite it", function(done) {
					request({
						method: "POST",
						url: serverUrl + "foo/collection",
						json: {
							"metatest": "foo",
							"_modifiedDate": 1,
							"_id": "metatestObject"
						}
					}, function(error, response, body) {
						expect(body._modifiedDate).toEqual(1);
						done();
					});
				});

				it("when modifing an object inside a collection, it should update the _modifiedDate meta property", function(done) {
					request({
						method: "PUT",
						url: serverUrl + "foo/collection/metatestObject",
						json: {
							"metatest": "bar"
						}
					}, function(error, response, body) {
						expect(body._modifiedDate).not.toEqual(1);
						//Deleting this test object
						request({
							method: "DELETE",
							url: serverUrl + "foo/collection/metatestObject",
						}, function() {
							done();
						})
					});
				});

			});

			describe("PATCH", function() {

				it("should allow you to send a PATCH request which extends an object without overwriting it", function(done) {
					request({
						method: "PATCH",
						url: serverUrl,
						json: {
							bar: {
								string: "i'm a string",
								baz: {
									innerValue: 1
								}
							}
						},
					}, function(error, response, body) {
						expect(body).toEqual({success: true});
						cantrip.get("/bar", function(err, data) {
							expect(data).toEqual({
								string: "i'm a string",
								baz: {
									innerValue: 1
								}
							});
							done();
						});
					});
				});

				it("should use deep merge when sending multi-level objects", function(done) {
					request({
						method: "PATCH",
						url: serverUrl,
						json: {
							bar: {
								string: "other string",
								baz: {
									innerValue: 2
								}
							}
						},
					}, function(error, response, body) {
						expect(body).toEqual({success: true});
						cantrip.get("/bar", function(err, data) {
							expect(data).toEqual({
								string: "other string",
								baz: {
									innerValue: 2
								}
							});
							done();
						});
					});
				});

			});

			describe("GET", function() {

				it("should get you the whole JSON when requesting the root", function(done) {
					request({
						method: "GET",
						url: serverUrl,
						json: true,
					}, function(error, response, body) {
						expect(body.foo).toBeDefined();
						expect(body.foo.collection.length).toBe(2);
						expect(body.foo.collection[0].foo).toBe("bar");
						expect(body.bar).toBeDefined();
						expect(body.bar.string).toBe("other string");
						expect(body.bar.baz).toEqual({innerValue: 2});
						done();
					});
				});

				it("should get you an object's single property wrapped in an object", function(done) {
					request({
						method: "GET",
						url: serverUrl + "bar/string",
						json: true,
					}, function(error, response, body) {
						expect(body).toEqual({
							value: "other string"
						});
						done();
					});
				});

				it("should throw an error when requesting a non existent node", function(done) {
					request({
						method: "GET",
						url: serverUrl + "nonexistent/bar/baz/foo",
						json: true,
					}, function(error, response, body) {
						expect(body.error).toBeDefined();
						done();
					});
				});

				it("should get you an array when requesting a collection", function(done) {
					request({
						method: "GET",
						url: serverUrl + "foo/collection",
						json: true,
					}, function(error, response, body) {
						expect(body.length).toBe(2);
						done();
					});
				});

				it("shouldn't matter if there is a query string at the end of the url", function(done) {
					request({
						method: "GET",
						url: serverUrl + "foo/collection?foo=bar&baz=true",
						json: true,
					}, function(error, response, body) {
						expect(body.length).toBe(2);
						done();
					});
				});

			});

			describe("DELETE", function() {
				var id = "";

				it("should allow you to delete a key from an object", function(done) {
					request({
						method: "DELETE",
						url: serverUrl + "bar/string",
						json: true,
					}, function(error, response, body) {
						expect(body).toEqual({"success": true});
						cantrip.get("/bar", function(err, data) {
							expect(data.string).not.toBeDefined();
							done();
						});
					});
				});

				it("but shouldn't let you delete an object's _id", function(done) {
					request({
						method: "DELETE",
						url: serverUrl + "foo/collection/0/_id",
						json: true,
					}, function(error, response, body) {
						console.log(body);

						expect(body.error).toBeDefined();
						cantrip.get("/foo/collection/0", function(err, data) {
							expect(data._id).toBeDefined();
							done();
						});
					});
				});

				it("nor should it let you delete an object's other metadata like _modifiedDate", function(done) {
					request({
						method: "DELETE",
						url: serverUrl + "foo/collection/0/_modifiedDate",
						json: true,
					}, function(error, response, body) {
						expect(body.error).toBeDefined();
						cantrip.get("/foo/collection/0", function(err, data) {
							expect(data._modifiedDate).toBeDefined();
							done();
						});
					});
				});

				it("should allow you to delete a model from a collection by index", function(done) {
					request({
						method: "DELETE",
						url: serverUrl + "foo/collection/0",
						json: true,
					}, function(error, response, body) {
						expect(body).toEqual({success: true});
						cantrip.get("/foo/collection", function(err, data) {
							expect(data.length).toBe(1);
							done();
						});
					});
				});

				it("should allow you to delete a model from a collection by id", function(done) {
					request({
						method: "DELETE",
						url: serverUrl + "foo/collection/" + id,
						json: true,
					}, function(error, response, body) {
						expect(body).toEqual({success: true});
						cantrip.get("/foo/collection", function(err, data) {
							expect(data.length).toEqual(0);
							done();
						});
					});
				});

				it("should allow you to delete a key from the root object", function(done) {
					request({
						method: "DELETE",
						url: serverUrl + "foo",
						json: true,
					}, function(error, response, body) {
						expect(body).toEqual({success: true});
						console.log(body);
						cantrip.get("/", function(err, data) {
							expect(data.foo).toBeUndefined();
							expect(data).toEqual({
								bar: {
									baz: {
										innerValue: 2
									}
								}
							});
							done();
						});
					});
				});


			});
		});
	});
});
