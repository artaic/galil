'use strict';

const path = require('path');
const webpack = require('webpack');

module.exports = {
  target: 'node',
  entry: path.join(__dirname, 'src', 'galil.js'),
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2'
  },
  module: {
    loaders: [{
      test: /\.js?$/,
      exclude: /node_modules/,
      loader: 'babel'
    }]
  },
  plugins: [
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      compressor: {
        screw_ie8: true,
        warnings: true
      }
    })
  ]
}
