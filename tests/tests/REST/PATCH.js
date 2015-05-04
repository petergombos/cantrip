var request = require("request");
var _ = require("lodash");
var should = require("chai").should();
var expect = require("chai").expect;
var fs = require("fs");
var initialData = JSON.parse(fs.readFileSync(__dirname + "/../../test.json"));

var server = require("../../helpers/setupTestServer.js");

describe("PATCH requests", function() {

	beforeEach(function() {
		server.resetData();
	});

	it("should allow you to patch the root object, adding properties to but not overwriting it", function(done) {
		request({
			method: "PATCH",
			url: server.url,
			json: {
				catsAre: "awesome"
			}
		}, function(error, response, body) {
			body.should.deep.equal({
				success: true
			});

			var inDatabase = server.cantrip.get("/");
			inDatabase.catsAre.should.equal("awesome");
			inDatabase.users.should.exist;
			done();
		});
	});

	it("should not let you PATCH an array", function(done) {
		request({
			method: "PATCH",
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

	it("should return an error when patching a non-existent node", function(done) {
		request({
			method: "PATCH",
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

	it("should allow you to override any object's values but leave the rest of the object alone", function(done) {
		request({
			method: "PATCH",
			url: server.url + "faz",
			json: {
				boo: "awesome"
			}
		}, function(error, response, body) {
			body.should.deep.equal({
				success: true
			});

			var inDatabase = server.cantrip.get("/faz");
			inDatabase.boo.should.equal("awesome");
			inDatabase.baa.should.equal(3);
			done();
		});
	});

	it("should update the object's _modifiedDate property", function(done) {

		var now = new Date();

		request({
			method: "PATCH",
			url: server.url + "users/31612a41ec88cef52f45cd2de5af7f7aa63cfdc4",
			json: {
				boo: "awesome"
			}
		}, function(error, response, body) {
			body.should.deep.equal({
				success: true
			});

			var inDatabase = server.cantrip.get("/users/31612a41ec88cef52f45cd2de5af7f7aa63cfdc4");
			inDatabase._modifiedDate.should.be.above(now);
			done();
		});
	});

	it("should deep merge objects", function(done) {
		request({
			method: "PATCH",
			url: server.url,
			json: {
				faa: 3,
				faz: {
					boo: "bee",
					baz: {
						goo: "correct",
						another: "value"
					}
				}
			}
		}, function(error, response, body) {
			body.should.deep.equal({
				success: true
			});

			var inDatabase = server.cantrip.get("/");
			inDatabase.faa.should.equal(3);
			inDatabase.foo.should.equal("bar");
			inDatabase.faz.boo.should.equal("bee");
			inDatabase.faz.boy.should.equal(true);
			inDatabase.faz.baz.goo.should.equal("correct");
			inDatabase.faz.baz.another.should.equal("value");


			done();
		});
	});

	it("should ignore arrays while patching", function(done) {
		request({
			method: "PATCH",
			url: server.url + "faz",
			json: {
				boo: 8,
				bar: {
					gee: 4
				},
				bay: 10
			}
		}, function(error, response, body) {
			var inDatabase = server.cantrip.get("/faz");
			inDatabase.boo.should.equal(8);
			inDatabase.baa.should.equal(3);
			inDatabase.bar.should.deep.equal([
				{
					"_createdDate": 1429879264012,
					"_modifiedDate": 1429879264012,
					"id": "a7dd76700e2ae7cd5de7a6e03c15b77b5406e42b",
					"foo": "aaa"
				},
				{
					"_createdDate": 1429879269206,
					"_modifiedDate": 1429879269206,
					"id": "6661c5b2d3c1d032f6cd8cae4468bdaee2428dcf",
					"foo": "aaa"
				},
				{
					"_createdDate": 1429879273117,
					"_modifiedDate": 1429879273117,
					"id": "a5e50a4c5dccb02a61090972fc5f121e9a61eede",
					"foo": "aab"
				}
			]);
			expect(inDatabase.bar[0].gee).to.not.exist;
			inDatabase.bay.should.equal(10);
			done();
		});
	});

});