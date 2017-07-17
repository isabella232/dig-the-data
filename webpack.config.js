'use strict';

const webpack = require('webpack');

const babelRule = {
  test: /\.js$/,
  exclude: /(node_modules|components)/,
  use: {
    loader: 'babel-loader',
    options: {
      presets: [
        [
          'env',
          {
            targets: {
              browsers: ['last 2 versions']
            },
            modules: false
          }
        ]
      ]
    }
  }
};

const webpackConfig = {
  devtool: 'source-map',
  module: {
    rules: [
      babelRule,
      {
        test: /\.json$/,
        loader: 'json-loader'
      }
    ]
  },
  plugins: [
    // To extract node_modules imports into a vendor.js file.
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      minChunks: module => module.context && module.context.includes('node_modules')
    })
  ]
};

module.exports = webpackConfig;