module.exports = {
	entry: './src/webstomp.js',
	output: {
		path: __dirname + '/dist',
		filename: 'webstomp.js',
		library: 'webstomp',
		libraryTarget: 'umd'
	},
	module: {
  	    rules: [
	    	{test: /\.js$/, use: ['babel-loader']}
	    ]
	}
};
