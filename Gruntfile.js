/*global module:false*/
module.exports = function(grunt) {

    require('load-grunt-tasks')(grunt);

    // Project configuration.
    grunt.initConfig({
        nodemon: {
            dev: {
                script: 'server.js',
                options: {
                    watch: ['server.js']
                }
            }
        }
    });

    //console.log(grunt.option.flags());

    grunt.registerTask('server', ["nodemon"]);

};