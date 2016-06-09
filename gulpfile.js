'use strict';

var gulp = require('gulp');
var webpack = require('webpack');
var del = require('del');
var karma = require('karma').Server;
var spawn = require('child_process').spawn;
var coveralls = require('gulp-coveralls');
var node;

gulp.task('clean', function(cb) {
    del.sync(['./dist/*']);
    cb();
});

gulp.task('testServer', ['clean'], function _testServer(cb) {
    if (node) {
        node.kill();
    }
    webpack({
        entry: './test/support/server-mock.js',
        output: {
            path: __dirname + '/dist/support',
            filename: 'server-mock.js'
        },
        module: {
            loaders: [
                {
                    test: /\.js$/,
                    loader: 'babel-loader',
                    exclude: /node_modules/
                }
            ]
        },
        target: 'node',
        resolve: {
            extensions: ['', '.js']
        }
    }, function(err) {
        if (err) {
            cb(err);

        } else {
            node = spawn('node', ['./dist/support/server-mock.js'], {stdio: 'inherit'});
            cb();
        }
    });
});

gulp.task('test', ['testServer'], function _test(cb) {
    // jscs:disable requireCapitalizedConstructors
    return new karma({
        configFile: __dirname + '/karma.conf.js',
        singleRun: true
    }, function _testCB(code) {
        if (node) {
            node.kill();
        }
        cb(code);
    }).start();
});

gulp.task('coverage', function _coverage(cb) {
    return gulp.src('dist/coverage/*/coverage.info')
        .pipe(coveralls());
});
