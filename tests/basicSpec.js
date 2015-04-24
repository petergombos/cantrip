var request = require("request");
var express = require('express');
var bodyParser = require('body-parser');
var cantrip = require("../index.js")({
	file: "data/test" + Math.floor(Math.random() * 10000000000) + ".json"
});

var should = require("chai").should();
var expect = require("chai").expect;


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
		should.exist(cantrip);
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
					body.should.be.deep.equal({
						success: true
					});
					var data = cantrip.get("/");
					expect(data).to.deep.equal({
						foo: "bar"
					});
					done();
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
					expect(body).to.deep.equal({success: true});
					var data = cantrip.get("/foo");
					expect(data).to.deep.equal({
						string: "some string",
						soonToBeRemoved: 3
					});
					done();
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
					expect(body).to.deep.equal({success: true});
					var data = cantrip.get("/foo");
					expect(data).to.deep.equal({
						collection: []
					});
					done();
				});
			});

			it("should have all modifications up until now saved", function(done) {
				request({
					method: "GET",
					url: serverUrl,
					json: true
				}, function(error, response, body) {
					expect(body).to.deep.equal({
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
					expect(body.error).to.exist;
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
					expect(body.foo).to.deep.equal("bar");
					expect(body._id).to.exist;
					expect(body._createdDate).to.exist;
					expect(body._modifiedDate).to.exist;
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
					expect(body._id).to.deep.equal("imanid");
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
					expect(body.error).to.exist;
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
					expect(body.error).to.exist;
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
					expect(body._modifiedDate).to.deep.equal(1);
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
					expect(body._modifiedDate).not.to.deep.equal(1);
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
					expect(body).to.deep.equal({success: true});
					var data = cantrip.get("/bar");
					expect(data).to.deep.equal({
						string: "i'm a string",
						baz: {
							innerValue: 1
						}
					});
					done();
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
					expect(body).to.deep.equal({success: true});
					var data = cantrip.get("/bar");
					expect(data).to.deep.equal({
						string: "other string",
						baz: {
							innerValue: 2
						}
					});
					done();
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
					expect(body.foo).to.exist;
					expect(body.foo.collection.length).to.equal(2);
					expect(body.foo.collection[0].foo).to.equal("bar");
					expect(body.bar).to.exist;
					expect(body.bar.string).to.equal("other string");
					expect(body.bar.baz).to.deep.equal({innerValue: 2});
					done();
				});
			});

			it("should get you an object's single property wrapped in an object", function(done) {
				request({
					method: "GET",
					url: serverUrl + "bar/string",
					json: true,
				}, function(error, response, body) {
					expect(body).to.deep.equal({
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
					expect(body.error).to.exist;
					done();
				});
			});

			it("should get you an array when requesting a collection", function(done) {
				request({
					method: "GET",
					url: serverUrl + "foo/collection",
					json: true,
				}, function(error, response, body) {
					expect(body.length).to.equal(2);
					done();
				});
			});

			it("shouldn't matter if there is a query string at the end of the url", function(done) {
				request({
					method: "GET",
					url: serverUrl + "foo/collection?foo=bar&baz=true",
					json: true,
				}, function(error, response, body) {
					expect(body.length).to.equal(2);
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
					expect(body).to.deep.equal({"success": true});
					var data = cantrip.get("/bar");
					expect(data.string).not.to.exist;
					done();
				});
			});

			it("but shouldn't let you delete an object's _id", function(done) {
				request({
					method: "DELETE",
					url: serverUrl + "foo/collection/0/_id",
					json: true,
				}, function(error, response, body) {
					console.log(body);

					expect(body.error).to.exist;
					var data = cantrip.get("/foo/collection/0");
					expect(data._id).to.exist;
					done();
				});
			});

			it("nor should it let you delete an object's other metadata like _modifiedDate", function(done) {
				request({
					method: "DELETE",
					url: serverUrl + "foo/collection/0/_modifiedDate",
					json: true,
				}, function(error, response, body) {
					expect(body.error).to.exist;
					var data = cantrip.get("/foo/collection/0");
					expect(data._modifiedDate).to.exist;
					done();
				});
			});

			it("should allow you to delete a model from a collection by index", function(done) {
				request({
					method: "DELETE",
					url: serverUrl + "foo/collection/0",
					json: true,
				}, function(error, response, body) {
					expect(body).to.deep.equal({success: true});
					var data = cantrip.get("/foo/collection");
					expect(data.length).to.equal(1);
					done();
				});
			});

			it("should allow you to delete a model from a collection by id", function(done) {
				request({
					method: "DELETE",
					url: serverUrl + "foo/collection/" + id,
					json: true,
				}, function(error, response, body) {
					expect(body).to.deep.equal({success: true});
					var data = cantrip.get("/foo/collection");
					expect(data.length).to.deep.equal(0);
					done();
				});
			});

			it("should allow you to delete a key from the root object", function(done) {
				request({
					method: "DELETE",
					url: serverUrl + "foo",
					json: true,
				}, function(error, response, body) {
					expect(body).to.deep.equal({success: true});
					console.log(body);
					var data = cantrip.get("/");
					expect(data.foo).not.to.exist;
					expect(data).to.deep.equal({
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