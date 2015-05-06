var request = require("request");
var _ = require("lodash");
var should = require("chai").should();
var expect = require("chai").expect;
var fs = require("fs");
var initialData = JSON.parse(fs.readFileSync(__dirname + "/../../test.json"));

var server = require("../../helpers/setupTestServer.js");

describe("PUT requests", function() {

	beforeEach(function() {
		server.resetData();
	});

	it("should allow you to put the root object, overwriting it (and deleting existing indexes)", function(done) {
		var creatingIndexes = server.cantrip.get("/users/31612a41ec88cef52f45cd2de5af7f7aa63cfdc4");
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

			var inDatabase = server.cantrip.get("/");
			inDatabase.should.deep.equal({
				catsAre: "awesome"
			});

			var isThereAnIndex = server.cantrip.get("/users/31612a41ec88cef52f45cd2de5af7f7aa63cfdc4");
			expect(isThereAnIndex).to.be.null;
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
		var creatingIndexes = server.cantrip.get("/faz/bar/6661c5b2d3c1d032f6cd8cae4468bdaee2428dcf");
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

			var inDatabase = server.cantrip.get("/faz");
			inDatabase.should.deep.equal({
				catsAre: "awesome"
			});

			var checkIfThereIsIndex = server.cantrip.get("/faz/bar/6661c5b2d3c1d032f6cd8cae4468bdaee2428dcf");
			expect(checkIfThereIsIndex).to.be.null;
			done();
		});
	});

	it("should leave metadata untouched when overriding an object in an array", function(done) {
		request({
			method: "PUT",
			url: server.url + "users/31612a41ec88cef52f45cd2de5af7f7aa63cfdc4",
			json: {
				foo: "bar"
			}
		}, function(error, response, body) {
			body.should.deep.equal({
				success: true
			});
			var inDatabase = server.cantrip.get("/users/31612a41ec88cef52f45cd2de5af7f7aa63cfdc4");
			inDatabase._id.should.equal("31612a41ec88cef52f45cd2de5af7f7aa63cfdc4");
			inDatabase._modifiedDate.should.be.above(1429879060304);
			inDatabase._createdDate.should.equal(1429879060304);
			inDatabase.foo.should.equal("bar");
			expect(inDatabase.email).to.not.exist;
			done();
		});
	});

});