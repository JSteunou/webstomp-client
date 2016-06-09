module.exports = {
    entry: ['./src/webstomp.js'],
    output: {
        path: __dirname + '/dist',
        filename: 'webstomp.js',
        library: 'webstomp',
        libraryTarget: 'umd'
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: 'babel-loader'
            }
        ]
    },
    resolve: {
        extensions: ['', '.js']
    }
};
