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
        jasmine_node: {
            options: {
                forceExit: true,
                match: '.',
                matchall: false,
                extensions: 'js',
                specNameMatcher: 'Spec',
                display: "full",
                summary: true
            },
            all: ['tests/']
        }
    });

    //console.log(grunt.option.flags());

    grunt.registerTask('server', ["nodemon"]);
    grunt.registerTask('test', ["jasmine_node"]);

};