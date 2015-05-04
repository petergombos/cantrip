var request = require("request");
var _ = require("lodash");
var should = require("chai").should();
var expect = require("chai").expect;
var fs = require("fs");
var initialData = JSON.parse(fs.readFileSync(__dirname + "/../../test.json"));



var server = require("../../helpers/setupTestServer.js");

describe("DELETE requests", function() {

	beforeEach(function() {
		server.resetData();
	});

	afterEach(function() {
		server.resetData();
	});

	it("should allow you to delete a key from an object", function(done) {
		request({
			method: "DELETE",
			url: server.url + "users",
			json: true
		}, function(error, response, body) {
			body.should.deep.equal({
				success: true
			});

			var inDatabase = server.cantrip.get("/");
			expect(inDatabase.users).to.not.exist;
			done();
		});
	});

	it("should allow you to delete an item from an array by their id", function(done) {
		request({
			method: "DELETE",
			url: server.url + "users/31612a41ec88cef52f45cd2de5af7f7aa63cfdc4",
			json: true
		}, function(error, response, body) {
			body.should.deep.equal({
				success: true
			});

			var inDatabase = server.cantrip.get("/users");
			inDatabase.should.have.length(1);
			done();
		});
	});

	it("should return an error when deleting a non-existent node", function(done) {
		request({
			method: "DELETE",
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

});