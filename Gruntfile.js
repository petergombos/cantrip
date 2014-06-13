/*global module:false*/
module.exports = function(grunt) {

    require('load-grunt-tasks')(grunt);

    // Project configuration.
    grunt.initConfig({
        nodemon: {
            dev: {
                script: 'server.js',
                options: {
                    watch: ['index.js', 'server.js']
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
            },
            all: ['tests/']
        }
    });

    //console.log(grunt.option.flags());

    grunt.registerTask('server', ["nodemon"]);
    grunt.registerTask('test', ["jasmine_node"]);

};