var request = require("request");
var serverUrl = "http://localhost:3000/"

describe("Cantrip is a database-less REST API library saving to a JSON file", function() {

	var Cantrip = require("../index.js");

	it("should initialize", function() {
		expect(Cantrip).toBeDefined();
	});

	Cantrip.start();

	describe("The REST API", function() {
		//Overwrite the JSON
		beforeEach(function() {
			Cantrip.data = {
				rootObject: {
					memberObject: {
						nestedParameter: 4,
						nestedParameter2: true,
						nestedParameter3: {
							foo: "bar"
						}
					},
					memberArray: [
						{
							name: "Object Member",
							foo: 3
						},
						[1,2,3],
						true
					],
					memberParameter: "sample String"
				},
				rootArray: [
					{
						name: "Model Member",
					},
					[7,8,9],
					false
				],
				rootParameter: true
			}
		});

		describe("GET", function() {

			it("should get you the root object", function() {
				request(serverUrl, function(error, response, body) {
					console.log(body);
					done();
				});
			});

		});

	});

});