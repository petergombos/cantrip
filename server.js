var Cantrip = require("./index.js");

/**
 * All options for Cantrip and their default values are listed here.
 * You can overwrite all settings in the command line by passing parameters with a port=2000 like syntax
 */

/**
 * Port to run the server on
 * @type {Number}
 */
Cantrip.options.port = process.env.PORT || 3000;

/**
 * Backup the memory to the JSON file every Nth POST/PUT/DELETE request.
 * Default is one, meaning the file is saved on every request.
 * A value of zero means it is never saved.
 * @type {Number}
 */
Cantrip.options.saveEvery = 1;

/**
 * Override which file to save to. Default is data.json.
 * @type {String}
 */
Cantrip.options.file = "data.json";

/**
 * Optionally you can also set the ip address the express server runs on.
 * @type {String}
 */
Cantrip.options.ip = "127.0.0.1";

Cantrip.start();

Cantrip.onReady = function() {
	Cantrip.data.remove(function(err, ds) {

		// Cantrip.setData("", {
		// 	"foo": {
		// 		"yo": "dawg",
		// 		bar: 3
		// 	}
		// });
		// 

		Cantrip.setData("", {
			"foo": [{
				"_id": "sass",
				"yo": {
					"dawg": 18
				}
			}],
			"bar": {
				"marci": {
					"deal": "yea"
				}
			}
		});

		Cantrip.getNode("", function(err, res) {
			console.log(res);
		});

		Cantrip.data.find({
			path: new RegExp(".+")
		}, function(err, res) {
			res.toArray(function(err, res) {
				console.log(res);
			})
		})


	});



}