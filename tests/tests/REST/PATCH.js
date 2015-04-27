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

			var inDatabase = cantrip.get("/");
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

	it("should return an error when putting a non-existent node", function(done) {
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

			var inDatabase = cantrip.get("/faz");
			inDatabase.boo.should.equal("awesome");
			inDatabase.baa.should.equal(3);
			done();
		});
	});

	it("should update the object's _modifiedDate property", function(done) {

		var now = new Date();

		request({
			method: "PATCH",
			url: server.url + "users/0",
			json: {
				boo: "awesome"
			}
		}, function(error, response, body) {
			body.should.deep.equal({
				success: true
			});

			var inDatabase = cantrip.get("/users/0");
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

			var inDatabase = cantrip.get("/");
			inDatabase.faa.should.equal(3);
			inDatabase.foo.should.equal("bar");
			inDatabase.faz.boo.should.equal("bee");
			inDatabase.faz.boy.should.equal(true);
			inDatabase.faz.baz.goo.should.equal("correct");
			inDatabase.faz.baz.another.should.equal("value");


			done();
		});
	});

	it("should deep merge objects when there is an array involved", function(done) {
		request({
			method: "PATCH",
			url: server.url + "users",
			json: {
				addedValue: "yay"
			}
		}, function(error, response, body) {
			var users = cantrip.get("/users");
			users[0].addedValue.should.equal("yay");
			users[1].addedValue.should.equal("yay");
		});
	});

});