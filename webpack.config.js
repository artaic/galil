import path from 'path';
import webpack from 'webpack';

export default {
  target: 'node',
  entry: path.join(__dirname, 'src', 'Galil.js'),
  output: {
    filename: 'galil.js',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, 'dist')
  },
  resolve: {
    extensions: ['', '.js', '.jsx', '.json'],
    root: path.resolve(path.join(__dirname, 'src')),
    packageMains: ['webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main']
  },
  module: {
    loaders: [{
      test: /\.jsx?$/,
      loaders: ['babel-loader'],
      exclude: /node_modules/
    }, {
      test: /\.json$/,
      loader: 'json-loader'
    }]
  },
  plugins: [
    // new webpack.NoErrorsPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    }),
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.ProvidePlugin({ 'Promise': 'bluebird' })
  ]
}
