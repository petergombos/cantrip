var request = require("request");
var _ = require("lodash");
var should = require("chai").should();
var expect = require("chai").expect;
var fs = require("fs");
var initialData = JSON.parse(fs.readFileSync(__dirname + "/../../test.json"));

var server = require("../../helpers/setupTestServer.js");

describe("GET requests", function() {

	beforeEach(function() {
		server.resetData();
	});

	it("should get you the whole JSON when requesting the root", function(done) {
		request({
			method: "GET",
			url: server.url,
			json: true,
		}, function(error, response, body) {
			body.should.deep.equal(initialData);
			done();
		});
	});

	it("should get you a nested object", function(done) {
		request({
			method: "GET",
			url: server.url + "faz",
			json: true,
		}, function(error, response, body) {
			body.should.deep.equal(initialData.faz);
			done();
		});
	});

	it("should get you a nested array", function(done) {
		request({
			method: "GET",
			url: server.url + "users",
			json: true,
		}, function(error, response, body) {
			body.should.deep.equal(initialData.users);
			done();
		});
	});

	it("should get you a single value", function(done) {
		request({
			method: "GET",
			url: server.url + "foo",
			json: true,
		}, function(error, response, body) {
			body.should.deep.equal({
				value: "bar"
			});
			done();
		});
	});

	it("should get you a deeply nested object", function(done) {
		request({
			method: "GET",
			url: server.url + "faz/baz",
			json: true,
		}, function(error, response, body) {
			body.should.deep.equal(initialData.faz.baz);
			done();
		});
	});

	it("should return an item from an array by specifying its index", function(done) {
		request({
			method: "GET",
			url: server.url + "users/0",
			json: true,
		}, function(error, response, body) {
			body.should.deep.equal(initialData.users[0]);
			done();
		});
	});

	it("should return an item from an array by specifying its _id", function(done) {
		request({
			method: "GET",
			url: server.url + "users/31612a41ec88cef52f45cd2de5af7f7aa63cfdc4",
			json: true,
		}, function(error, response, body) {
			body.should.deep.equal(initialData.users[0]);
			done();
		});
	});

	it("should return an error when requesting a non-existent node", function(done) {
		request({
			method: "GET",
			url: server.url + "iamnonexistent",
			json: true,
		}, function(error, response, body) {
			response.statusCode.should.equal(404);
			expect(body.error).to.exist;
			done();
		});
	});

	it("should only return a shallow copy of an object when given the shallow parameter", function(done) {
		request({
			method: "GET",
			url: server.url + "?shallow=true",
			json: true,
		}, function(error, response, body) {
			body.users.should.equal("[object Array]");
			body.foo.should.equal("bar");
			body.faz.should.equal("[object Object]")
			done();
		});
	});

	it("should only return a shallow copy of all items in an array when given the shallow parameter", function(done) {
		request({
			method: "GET",
			url: server.url + "users/31612a41ec88cef52f45cd2de5af7f7aa63cfdc4?shallow=true",
			json: true,
		}, function(error, response, body) {
			body.facebook.should.equal("[object Object]");
			body.name.should.equal("Márton Borlay");
			done();
		});
	});

	it("should search for a string in all keys on the first layer of objects when specifying a q parameter (case insensitive)", function(done) {
		request({
			method: "GET",
			url: server.url + "far?q=zZz",
			json: true,
		}, function(error, response, body) {
			body.should.have.length(3);
			done();
		});
	});

	it("should also search based on a JSON object we pass in (case insensitive values)", function(done) {
		request({
			method: "GET",
			url: server.url + 'far?q={"foo":"zZz","bar": 123}',
			json: true,
		}, function(error, response, body) {
			body.should.have.length(2);
			done();
		});
	});

	it("should let you order by a given key with the orderby parameter", function(done) {
		request({
			method: "GET",
			url: server.url + 'far?orderby=foo',
			json: true,
		}, function(error, response, body) {
			body.should.deep.equal(_.sortBy(initialData.far, function(item) {
				return item.foo;
			}));
			body[0].should.deep.equal(initialData.far[6]);
			body[body.length - 1].foo.should.equal("zzz");
			done();
		});
	});

	it("should reverse the order if given a minus sign before the field name", function(done) {
		request({
			method: "GET",
			url: server.url + 'far?orderby=-foo',
			json: true,
		}, function(error, response, body) {
			body.should.deep.equal(_.sortBy(initialData.far, function(item) {
				return item.foo;
			}).reverse());
			body[body.length - 1].should.deep.equal(initialData.far[6]);
			body[0].foo.should.equal("zzz");
			done();
		});
	});

	it("should only return n number of items from an array when specifying the limit parameter", function(done) {
		request({
			method: "GET",
			url: server.url + 'far?limit=2',
			json: true,
		}, function(error, response, body) {
			body.should.have.length(2);
			done();
		});
	});

	it("should skip n number of items from an array when specifying the offset parameter", function(done) {
		request({
			method: "GET",
			url: server.url + 'far?offset=2',
			json: true,
		}, function(error, response, body) {
			body.should.have.length(initialData.far.length - 2);
			done();
		});
	});

	it("should only return specific fields if the fields parameter is set", function(done) {
		request({
			method: "GET",
			url: server.url + '?fields=foo,faa',
			json: true,
		}, function(error, response, body) {
			body.should.deep.equal({
				foo: "bar",
				faa: 2
			});
			done();
		});
	});

	it("should only return specific fields of items in an array if the fields parameter is set", function(done) {
		request({
			method: "GET",
			url: server.url + 'users?fields=name',
			json: true,
		}, function(error, response, body) {
			body.should.deep.equal([
				{
					name: "Márton Borlay"
				},{
					name: "Péter Gombos"
				}]);
			done();
		});
	});

});