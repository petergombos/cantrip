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

Cantrip.start();
