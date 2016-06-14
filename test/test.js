var webpack = require('webpack');
var karma = require('karma').Server;
var spawn = require('child_process').spawn;
var coveralls = require('coveralls');
var path = require('path');
var node = null;


function main() {
    if (node) {
        node.kill();
    }
    var srcPath = path.join(__dirname, 'support', 'server-mock.js');
    var destDirPath = path.join(__dirname, 'tmp', 'support');
    var destPath = path.join(destDirPath, 'server-mock.js');
    webpack({
        entry: srcPath,
        output: {
            path: destDirPath,
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
    }, (err) => {
        if (err) {
            console.log(err);
            process.exit(1);

        } else {
            node = spawn('node', [destPath], {stdio: 'inherit'});
            test();
        }
    });
}

function test() {
    var testConfig = path.join(__dirname, '..', 'karma.conf.js');
    new karma({
        configFile: testConfig,
        singleRun: true
    }, (code) => {
        if (node) {
            node.kill();
        }
        if (code !== 0) {
            console.log('test failed');
            process.exit(code);
        }
    }).start();
}

if (require.main === module) {
    main();
}
