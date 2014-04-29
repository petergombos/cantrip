var request = require("request");

describe("Cantrip is a database-less REST API library saving to a JSON file", function() {

	var Cantrip = require("../index.js");
	Cantrip.options.port = 3001;
	var serverUrl = "http://localhost:3001/";

	it("should initialize", function() {
		expect(Cantrip).toBeDefined();
	});

	Cantrip.options.file = "tests/test" + Math.floor(Math.random() * 10000000000) + ".json";

	Cantrip.start();


	describe("Basic REST API functions", function() {

		describe("PUT", function() {

			it("should allow you to put the root object", function(done) {
				request({
						method: "PUT",
						url: serverUrl,
						json: {foo: "bar"} 
					}, function(error, response, body) {
					expect(body).toEqual({foo: "bar"});
					done();
				});
			});

			it("should allow you to modify previous values", function(done) {
				request({
						method: "PUT",
						url: serverUrl,
						json: {foo: {string: "some string", collection : []}}
					}, function(error, response, body) {
					expect(body.foo).toEqual({string: "some string", collection : []});
					done();
				});
			});

			it("should allow you to put children", function(done) {
				request({
						method: "PUT",
						url: serverUrl + "foo",
						json: {string: "other string"}
					}, function(error, response, body) {
					expect(body).toEqual({string: "other string", collection : []});
					done();
				});
			});

			it("should have all modifications up until now saved", function(done) {
				request({
						method: "GET",
						url: serverUrl,
						json: true
					}, function(error, response, body) {
					expect(body).toEqual({foo: {string: "other string", collection : []}});
					done();
				});
			})

		});

		describe("POST", function() {

			it("should throw an error when posting to something other than a collection", function(done) {
				request({
						method: "POST",
						url: serverUrl,
						json: {"foo": "bar"}
					}, function(error, response, body) {
					expect(body.error).toBeDefined();
					done();
				});
			});

			it("should allow you to post to a collection and generate you an id", function(done) {
				request({
						method: "POST",
						url: serverUrl + "foo/collection",
						json: {"foo": "bar"}
					}, function(error, response, body) {
					expect(body.foo).toEqual("bar");
					expect(body._id).toBeDefined();
					done();
				});
			});

			it("should allow you to post to a collection with a specific id and not overwrite it", function(done) {
				request({
						method: "POST",
						url: serverUrl + "foo/collection",
						json: {"foo": "bar", "_id" : "imanid"}
					}, function(error, response, body) {
					expect(body._id).toEqual("imanid");
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
						expect(body).toEqual({value: "other string"});
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

		});

		describe("DELETE", function() {
			var id = "";

			it("should allow you to delete a key from an object", function(done) {
				request({
						method: "DELETE",
						url: serverUrl + "foo/string",
						json: true,
					}, function(error, response, body) {
					expect(body.string).toBeUndefined();
					done();
				});
			});

			it("but shouldn't let you delete an object's _id", function(done) {
				request({
						method: "DELETE",
						url: serverUrl + "foo/collection/0/_id",
						json: true,
					}, function(error, response, body) {
					expect(body.error).toBeDefined();
					done();
				});
			});

			it("should allow you to delete a model from a collection by index", function(done) {
				request({
						method: "DELETE",
						url: serverUrl + "foo/collection/0",
						json: true,
					}, function(error, response, body) {
					expect(body.length).toBe(1);
					id = body[0]._id;
					done();
				});
			});

			it("should allow you to delete a model from a collection by id", function(done) {
				request({
						method: "DELETE",
						url: serverUrl + "foo/collection/" + id,
						json: true,
					}, function(error, response, body) {
					expect(body).toEqual([]);
					done();
				});
			});





		});

		

	});

});