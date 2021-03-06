var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var config = require('./webpack.config');

new WebpackDevServer(webpack(config), {
  publicPath: config.output.publicPath,
  hot: true,
  historyApiFallback: true,
  stats: {
    colors: true
  },
  proxy: {
    "/api/*": "http://localhost:5000/",
  },
}).listen(3000, '0.0.0.0', function (err) {
  if (err) {
    console.log(err);
  }

  console.log('Listening at localhost:3000');
});
