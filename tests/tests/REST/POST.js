var request = require("request");
var _ = require("lodash");
var should = require("chai").should();
var expect = require("chai").expect;
var fs = require("fs");
var initialData = JSON.parse(fs.readFileSync(__dirname + "/../../test.json"));

var server = require("../../helpers/setupTestServer.js");

describe("POST requests", function() {
	
	beforeEach(function() {
		server.resetData();
	});

	it("should return an error when trying to post to an object", function(done) {
		request({
			method: "POST",
			url: server.url,
			json: {
				catsAre: "awesome"
			}
		}, function(error, response, body) {
			body.error.should.exist;
			response.statusCode.should.equal(400);
			done();
		});
	});

	it("should return an error when posting to a non-existent node", function(done) {
		request({
			method: "POST",
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

	it("should allow you to post to a collection", function(done) {
		request({
			method: "POST",
			url: server.url + "users",
			json: {
				name: "John Doe",
				email: "j.doe@gmail.com"
			}
		}, function(error, response, body) {
			body._id.should.have.length(40);
			body._modifiedDate.should.be.above(1429879060304);
			body._createdDate.should.be.above(1429879060304);
			body._createdDate.should.equal(body._modifiedDate);

			var _id = body._id;
			var _modifiedDate = body._modifiedDate;
			var _createdDate = body._createdDate;


			var inDatabase = server.cantrip.get("/users/" + _id);

			inDatabase._id.should.equal(_id);
			inDatabase._modifiedDate.should.equal(_modifiedDate);
			inDatabase._createdDate.should.equal(_createdDate);
			done();

		});
	});

	it("should allow you to specify your own id", function(done) {
		request({
			method: "POST",
			url: server.url + "users",
			json: {
				_id: "customid",
				name: "John Doe",
				email: "j.doe@gmail.com"
			}
		}, function(error, response, body) {
			body._id.should.equal("customid");

			var inDatabase = server.cantrip.get("/users/customid");

			inDatabase._id.should.equal("customid");
			done();

		});
	});

	it("shouldn't allow you to post with an id that already exists in the collection", function(done) {
		request({
			method: "POST",
			url: server.url + "users",
			json: {
				_id: "31612a41ec88cef52f45cd2de5af7f7aa63cfdc4",
				name: "John Doe",
				email: "j.doe@gmail.com"
			}
		}, function(error, response, body) {
			body.error.should.exist;
			response.statusCode.should.equal(400);
			done();
		});
	});

});