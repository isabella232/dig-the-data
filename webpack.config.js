'use strict';

const path = require('path');
const glob = require('glob');
const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');

const env = process.env.ENV;
const isProduction = env === 'production';

// Find all jsx pages at the root of the js src structure.
const baseEntry = [];
const entries = {};
glob.sync('./src/js/*.{jsx,js}').forEach((page) => {
  const entryName = path.basename(page, path.extname(page));
  const fileName = `./${path.basename(page)}`;
  entries[entryName] = baseEntry.concat([fileName]);
});

const babelRule = {
  test: /\.js$/,
  exclude: /node_modules/,
  use: {
    loader: 'babel-loader',
    options: {
      presets: [
        [
          'env',
          {
            targets: {
              browsers: ['last 2 versions'],
            },
            modules: false,
          },
        ],
      ],
    },
  },
};

const outputPath = path.resolve(__dirname, 'public/js');

const webpackConfig = {
  devtool: 'source-map',
  context: path.resolve(__dirname, 'src/js'),
  entry: entries,
  resolve: {
    extensions: ['.js', '.json', '.jsx']
  },
  output: {
    filename: '[name].js',
    path: outputPath,
    publicPath: '/js/'
  },
  module: {
    rules: [
      babelRule,
      {
        test: /\.json$/,
        loader: 'json-loader',
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin([outputPath]),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      jquery: 'jquery'
    }),
    // To extract node_modules imports into a vendor.js file.
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      minChunks: module => module.context && module.context.includes('node_modules'),
    })
  ]
};

if (isProduction) {
  webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin({
    sourceMap: true,
  }));
}

module.exports = webpackConfig;
