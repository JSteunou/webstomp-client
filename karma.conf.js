// Karma configuration
// Generated on Sat Jun 04 2016 17:41:44 GMT+0800 (中国标准时间)
var webpack = require('karma-webpack');

module.exports = function(config) {
    config.set({
        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '',
        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha'],
        // list of files / patterns to load in the browser
        files: [
            'node_modules/core-js/client/core.js',
            'test/utils-test.js',
            'test/frame-test.js',
            'test/webstomp-test.js',
            'test/client-test.js'
        ],
        plugins: [
            webpack,
            'karma-mocha',
            'karma-firefox-launcher',
            'karma-chrome-launcher',
            'karma-ie-launcher',
            'karma-coverage'
        ],
        // list of files to exclude
        exclude: [],
        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            'test/*.js': ['webpack'],
            'src/**/*.js': ['webpack']
        },
        webpack: {
            module: {
                preLoaders: [
                    {
                        test: /\.js$/,
                        loader: 'isparta',
                        exclude: /(node_modules|test)/
                    }
                ],
                loaders: [
                    {
                        test: /\.js$/,
                        loader: 'babel-loader',
                        exclude: /node_modules/
                    }
                ]
            },
            resolve: {
                extensions: ['', '.js']
            },
            externals: {
                ws:'WebSocket'
            },
            debug: true
        },
        webpackMiddleware: {
            noInfo: true
        },
        reporters: ['progress', 'coverage'],
        coverageReporter: {
            dir: 'dist/coverage/',
            subdir: function(browser) {
                return browser.toLowerCase().split(/[ /-]/)[0];
            },
            reporters: [{
                type: 'html',
                file: 'coverage.html'
            }, {
                type: 'lcovonly',
                file: 'coverage.info'
            }],
            watermarks: {
                statements: [60, 90],
                functions: [60, 90],
                branches: [60, 90],
                lines: [60, 90]
            }
        },
        // web server port
        port: 1110,
        // enable / disable colors in the output (reporters and logs)
        colors: true,
        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_INFO,
        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: true,
        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['IE', 'Chrome'],
        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: false,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: Infinity
    });
    if (process.env.TRAVIS) {
        config.customLaunchers = {
            Chrome: {
                base: 'Chrome',
                flags: ['--no-sandbox']
            }
        };
        config.browsers = ['Firefox', 'Chrome'];
    }
};
