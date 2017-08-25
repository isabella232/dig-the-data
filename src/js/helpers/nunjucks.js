'use strict';

const nunjucks = require('nunjucks');

const env = nunjucks.configure({
  watch: false
});

env.addFilter('formatCurrency', (val, currency, minFrac = 0, maxFrac = 0) => {
  return val.toLocaleString(navigator.language || 'en-US', {
    currency,
    style: 'currency',
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac
  });
});

env.addFilter('formatNumber', (val, minFrac = 0, maxFrac = 0) => {
  return val.toLocaleString(navigator.language || 'en-US', {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac
  });
});

module.exports = env;
