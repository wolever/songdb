var path = require('path');
var webpack = require('webpack');

var IS_DEV = !process.env.PROD;
var IS_PROD = !IS_DEV;

module.exports = {
  devtool: IS_DEV && 'eval-source-map',
  entry: {
    '_dummy_base': ['./songdb/base.js'],
    'app': ['./songdb/index'].concat(IS_DEV? [
      'webpack-dev-server/client?http://localhost:3000',
      'webpack/hot/only-dev-server',
    ] : []),
  },

  output: {
    path: path.join(__dirname, 'static/dist'),
    filename: '[name].js',
    publicPath: '/static/dist/',
    sourceMapFilename: IS_DEV && '[file].map',
  },

  plugins: [
    new webpack.optimize.CommonsChunkPlugin('base.js', ['_dummy_base', 'app']),
    new webpack.DefinePlugin({
      "SEARCH_API_ENDPOINT": JSON.stringify(process.env.SEARCH_API_ENDPOINT || "/api/search"),
    }),
  ].concat(IS_DEV? [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoErrorsPlugin()
  ] : [
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify('production')
      }
    }),
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      compressor: { warnings: false },
    }),
  ]),

  resolve: {
    root: __dirname,
    extensions: ['', '.js', '.jsx']
  },
  module: {
    loaders: [
      { test: /\.jsx?$/, loaders: ['react-hot', 'babel'], include: path.join(__dirname, 'songdb') },
      { test: /\.less$/, loaders: ['style', 'css', 'less'] },

      { test: /bootstrap\/js\//, loader: 'imports?jQuery=jquery' },
      { test: /\.woff2?(\?v=\d+\.\d+\.\d+)?$/, loader: "url?limit=10000&minetype=application/font-woff" },
      { test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, loader: "url?limit=10000&minetype=application/octet-stream" },
      { test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, loader: "file" },
      { test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, loader: "url?limit=10000&minetype=image/svg+xml" }
    ],
  }
};
