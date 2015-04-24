var request = require("request");

var should = require("chai").should();
var expect = require("chai").expect;
var fs = require("fs");
var initialData = JSON.parse(fs.readFileSync(__dirname + "/../../test.json"));

var cantrip = require("../../../index.js")({
	saveFrequency: 0,
	file: "../../test.json"
});


var server = require("../../helpers/setupTestServer.js")(cantrip);

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
			expect(body).to.deep.equal(initialData);
			done();
		});
	});

});