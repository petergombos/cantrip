var request = require("request");
var _ = require("lodash");
var should = require("chai").should();
var expect = require("chai").expect;
var fs = require("fs");
var initialData = JSON.parse(fs.readFileSync(__dirname + "/../../test.json"));

var cantrip = require("../../../index.js")({
	saveFrequency: 0,
	file: "../../test.json"
});


var server = require("../../helpers/setupTestServer.js")(cantrip);

describe("PUT requests", function() {

	beforeEach(function() {
		server.resetData();
	});

	it("should allow you to put the root object, overwriting it", function(done) {
		request({
			method: "PUT",
			url: server.url,
			json: {
				catsAre: "awesome"
			}
		}, function(error, response, body) {
			body.should.deep.equal({
				success: true
			});

			var inDatabase = cantrip.get("/");
			inDatabase.should.deep.equal({
				catsAre: "awesome"
			});
			done();
		});
	});

	it("should not let you PUT an array", function(done) {
		request({
			method: "PUT",
			url: server.url + "users",
			json: {
				catsAre: "awesome"
			}
		}, function(error, response, body) {
			body.error.should.exist;
			response.statusCode.should.equal(400);
			done();
		});
	});

	it("should return an error when putting a non-existent node", function(done) {
		request({
			method: "PUT",
			url: server.url + "iamnonexistent",
			json: {
				catsAre: "awesome"
			}
		}, function(error, response, body) {
			response.statusCode.should.equal(404);
			expect(body.error).to.exist;
			done();
		});
	});

	it("should allow you to override any object's keys", function(done) {
		request({
			method: "PUT",
			url: server.url + "faz",
			json: {
				catsAre: "awesome"
			}
		}, function(error, response, body) {
			body.should.deep.equal({
				success: true
			});

			var inDatabase = cantrip.get("/faz");
			inDatabase.should.deep.equal({
				catsAre: "awesome"
			});
			done();
		});
	});

});