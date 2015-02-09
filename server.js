var fs = require("fs");
var Cantrip = require("./index.js");

/**
 * All options for Cantrip and their default values are listed here.
 * You can overwrite all settings in the command line by passing parameters with a port=2000 like syntax
 */

/**
 * Port to run the server on
 * @type {Number}
 */
Cantrip.options.port = process.env.PORT || 5000;

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

Cantrip.options.namespace = "data.json";
/**
 * Optionally you can also set the ip address the express server runs on.
 * @type {String}
 */
Cantrip.options.ip = "127.0.0.1";

/**
 * Switch the default persistence layer. Import your persistence module to add it
 * @type {Object}
 */
//Cantrip.options.persistence = jsonPersistence;

/**
 * Create a https server too
 * @type {Object}
 */
// Cantrip.options.https = {
// 	key: fs.readFileSync(process.env["HOME"] + '/.credentials/server.key', 'utf8'),
// 	cert: fs.readFileSync(process.env["HOME"] + '/.credentials/server.crt', 'utf8'),
// 	port: 443
// };
// 

Cantrip.start();



