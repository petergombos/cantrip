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

		

	});

});