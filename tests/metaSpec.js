var request = require("request");
var Cantrip = require("./basicSpec.js");

describe("Cantrip's _meta attributes provide a place to store metadata.", function() {

	var serverUrl = "http://localhost:3001/";

	describe("Accessing and modifying _meta objects", function() {

		it("creating a new _meta object can be done by putting the special _meta endpoint", function(done) {
			request({
				method: "PUT",
				url: serverUrl + "_meta",
				json: {
					_contents: {
						foo: "bar"
					},
					_auth: false
				}
			}, function(error, response, body) {
				expect(body).toEqual({success: true});
				Cantrip.dataStore.get("/", function(err, data) {
					expect(data).toEqual({
						_contents: {
							foo: "bar"
						},
						_auth: false
					});
					done();
				});
			});
		});

		it("getting the root returns the value of the _contents meta object if it exists", function(done) {
			request({
				method: "GET",
				url: serverUrl,
				json: {}
			}, function(error, response, body) {
				expect(body).toEqual({
					foo: "bar"
				});
				done();
			});
		});

		it("getting the special _meta endpoint returns the whole JSON complete with meta objects", function(done) {
			request({
				method: "GET",
				url: serverUrl + "_meta",
				json: {}
			}, function(error, response, body) {
				expect(body).toEqual({
					"_contents": {
						"foo": "bar"
					},
					"_auth": false
				});
				done();
			});
		});

		it("you can also GET a specific _meta object", function(done) {
			request({
				method: "GET",
				url: serverUrl + "_auth",
				json: {}
			}, function(error, response, body) {
				expect(body).toEqual({
					value: false
				});
				done();
			});
		});

	});

});