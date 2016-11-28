'use strict';

const path = require('path'),
  nunjucks = require('nunjucks'),
  config = require('./config');

const env = nunjucks.configure(path.join(__dirname, '..', 'views'), {
  watch: false,
  noCache: true
});

env.addGlobal('dataBaseUrl', config.dataBaseUrl);

module.exports = env;
