/*global module:false*/
module.exports = function(grunt) {

    require('load-grunt-tasks')(grunt);

    // Project configuration.
    grunt.initConfig({
        nodemon: {
            dev: {
                script: 'examples/server.js',
                options: {
                    watch: ['index.js', 'examples/server.js', 'lib/dataStore.js', 'lib/acl.js']
                }
            }
        },
        mochaTest: {
            test: {
                options: {
                  reporter: 'spec',
                  quiet: false, // Optionally suppress output to standard out (defaults to false)
                  clearRequireCache: false // Optionally clear the require cache before running tests (defaults to false)
                },
                src: ['tests/**/*.js']
              }
        }
    });

    //console.log(grunt.option.flags());

    grunt.registerTask('server', ["nodemon"]);
    grunt.registerTask('test', ["mochaTest"]);

};