var request = require("request");
var Cantrip;

describe("Cantrip is a database-less REST API library saving to a JSON file", function() {

	Cantrip = require("../index.js");
	Cantrip.options.port = 3001;
	var serverUrl = "http://localhost:3001/";

	it("should initialize", function() {
		expect(Cantrip).toBeDefined();
	});

	Cantrip.options.namespace = "test" + Math.floor(Math.random() * 10000000000);

	Cantrip.start();


	describe("Basic REST API functions", function() {

		describe("PUT", function() {

			it("should allow you to put the root object", function(done) {
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
					Cantrip.dataStore.get("/", function(err, data) {
						expect(data).toEqual({
							foo: "bar"
						});
						done();
					});
				});
			});

			it("should allow you to modify previous values", function(done) {
				request({
					method: "PUT",
					url: serverUrl,
					json: {
						foo: {
							string: "some string",
							collection: []
						}
					}
				}, function(error, response, body) {
					expect(body).toEqual({success: true});
					Cantrip.dataStore.get("/foo", function(err, data) {
						expect(data).toEqual({
							string: "some string",
							collection: []
						});
						done();
					});
				});
			});

			it("should allow you to put children", function(done) {
				request({
					method: "PUT",
					url: serverUrl + "foo",
					json: {
						string: "other string"
					}
				}, function(error, response, body) {
					expect(body).toEqual({success: true});
					Cantrip.dataStore.get("/foo", function(err, data) {
						expect(data).toEqual({
							string: "other string",
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
							string: "other string",
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

		describe("GET", function() {

			it("should get you the whole JSON when requesting the root", function(done) {
				request({
					method: "GET",
					url: serverUrl,
					json: true,
				}, function(error, response, body) {
					expect(body.foo).toBeDefined();
					expect(body.foo.string).toBe("other string");
					expect(body.foo.collection.length).toBe(2);
					expect(body.foo.collection[0].foo).toBe("bar");
					done();
				});
			});

			it("should get you an object's single property wrapped in an object", function(done) {
				request({
					method: "GET",
					url: serverUrl + "foo/string",
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
					url: serverUrl + "foo/string",
					json: true,
				}, function(error, response, body) {
					expect(body).toEqual({"success": true});
					Cantrip.dataStore.get("/foo", function(err, data) {
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
					expect(body.error).toBeDefined();
					Cantrip.dataStore.get("/foo/collection/0", function(err, data) {
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
					Cantrip.dataStore.get("/foo/collection/0", function(err, data) {
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
					Cantrip.dataStore.get("/foo/collection", function(err, data) {
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
					Cantrip.dataStore.get("/foo/collection", function(err, data) {
						expect(data).toEqual([]);
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
					Cantrip.dataStore.get("/", function(err, data) {
						expect(data).toEqual({});
						done();
					});
				});
			});


		});
	});
});

module.exports = Cantrip;