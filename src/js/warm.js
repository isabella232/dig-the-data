'use strict';

/**
 * Global requirements jQuery ($)
 */

const d3 = require('d3');
const HeatMap = require('./helpers/d3heatmap');
const logger = require('./helpers/logger');

const setup = data => {
  const heatmap = new HeatMap('#heat-map svg');
  let dataSelection = 'views';
  let country = '';

  const update = () => {
    const dataPoints = [];
    for (const dow of d3.range(1, 8)) {
      for (const hour of d3.range(0, 24)) {
        const hourData = data.countries[dow][hour];
        let keys;
        if (country) keys = [country];
        else keys = Object.keys(hourData);

        const dataPoint = { dow, hour, cnt: 0 };
        for (const countryKey of keys) {
          const countryInner = hourData[countryKey] || {};
          dataPoint.cnt += dataSelection === 'clicks' ? (countryInner.c || 0) : (countryInner.v || 0);
        }
        dataPoints.push(dataPoint);
      }
    }
    heatmap.update(dataPoints);
  };

  $('#country-select').on('hidden.bs.select', () => {
    country = $('#country-select').val();
    update();
  });

  $('#data-selection .btn').on('click', e => {
    dataSelection = $(e.target).find('input').val();
    update();
  });

  update();
};

const setupCountrySelect = countries => {
  countries = countries.sort((a, b) => a.name < b.name ? -1 : 1);
  const $select = $('#country-select');
  for (const country of countries) {
    $('<option>')
      .val(country.num)
      .text(String(country.name).substring(0, 50))
      .appendTo($select);
  }

  $select.selectpicker();
};

const start = () => {
  const url = window.DATA_BASE_URL + '/warm.json';
  const $loader = $('#loader');
  const $prog = $('#progress');
  d3.json(url)
    .on('progress', e => {
      if (e && e.lengthComputable) {
        const prog = Math.round(e.loaded / e.total * 100);
        $prog.text(`${prog}%`);
      }
    })
    .on('error', e => logger.error(e))
    .on('load', data => {
      $loader.hide();
      $('.container').show();
      logger.debug('Data fetched', ...Object.keys(data).map(k => `${k}: ${data[k].length}`));
      setup(data);
    })
    .get();
  d3.json(window.DATA_BASE_URL + '/countries.json', (err, data) => {
    setupCountrySelect(data.countries);
  })
};

$(document).ready(() => {
  start();
});
