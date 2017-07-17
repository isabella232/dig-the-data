'use strict';

const topojson = require('topojson'),
  util = require('./d3util'),
  vars = require('../../shared/variables.json');

class WorldMap {
  constructor(selector, options = {}) {
    this.selector = selector;
    const $map = $(selector);
    this.map = d3.select(selector);

    // Set initial width-height of map.
    this.mapWidth = $map.width();
    this.mapRatio = options.mapRatio || 0.5;
    this.mapHeight = this.mapWidth * this.mapRatio;
    this.map.attr('height', this.mapHeight);

    // Generally we are interested in showing colors on a gradient scale.
    this.fromColor = options.fromColor || vars.$navy;
    this.toColor = options.toColor || vars.$green;
    this.emptyColor = options.emptyColor || this.fromColor;
    this.colorScale = d3.scaleLinear()
      .range([this.fromColor, this.toColor]);
    // NOTE: the domain of the colorscale has not been set yet.

    this.tooltip = options.tooltip || d3.select('#tooltip');

    this.value = options.value || (d => d.value);
    this.valueLabel = options.valueLabel || (d => (d.value || 0).toLocaleString());

    this.projection = options.projection || d3.geoMercator()
      .scale((this.mapWidth + 1) / 3 / Math.PI)
      .translate([this.mapWidth / 2, this.mapHeight / 1.5]);

    this.geoPath = d3.geoPath().projection(this.projection);

    const resolution = options.resolution || '110m';
    this.queue = d3.queue()
      .defer(d3.json, window.DATA_BASE_URL + `/${resolution}.json`)
      .defer(d3.json, window.DATA_BASE_URL + `/countries.json`)
      .awaitAll((err, [world, countries]) => {
        countries = d3.map(countries.countries, d => d.num);
        this.draw(world, countries);
      });
  }

  /**
   * Updates the map with the given data.
   * @param {Array} data - The data to update with
   */
  update(data) {
    this.colorScale.domain(d3.extent(data, this.value));

    const countryG = this.map.selectAll(`g.country`)
      .select('path')
      .attr('fill', d => {
        const entry = data.find(dd => dd.country === d.id);
        if (!entry) {
          return this.emptyColor;
        }
        d.value = this.value(entry);
        return this.colorScale(d.value);
      });

    // Manually run through the data since we don't want to override the features.
    for (const entry of data) {
    }
  }

  draw(world, countries) {
    // Run through all the world features and add some metadata to their
    const features = topojson.feature(world, world.objects.countries).features;
    for (const feature of features) {
      feature.centroid = this.geoPath.centroid(feature);

      if (countries.has(feature.id)) {
        const country = countries.get(feature.id);
        feature.centroidP = this.projection([country.long, country.lat]);
        feature.name = country.name;
      }
    }

    const _this = this;
    this.map.append('g')
      .attr('class', 'countries')
      .selectAll('g')
      .data(features)
      .enter().append('g')
        .attr('id', d => `country-${d.id}`)
        .classed('country', true)
        .append('path')
          .attr('fill', this.emptyColor)
          .attr('d', this.geoPath)
      .on('mouseover', function(d, i) {
        _this.tooltip.style('display', null)
          .transition().duration(300)
          .style('opacity', .9);
        _this.tooltip.html(_this.tooltipText(d));
        d3.select(this).classed('hover', true);
      })
      .on('mousemove', () => {
        _this.tooltip.style('left', `${d3.event.pageX}px`).style('top', `${d3.event.pageY + 28}px`);
      })
      .on('mouseout', function() {
        _this.tooltip.style('opacity', 0).style('display', 'none');
        d3.select(this).classed('hover', false);
      });
  }

  tooltipText(d) {
    return '<div class="country">' +
      `<div class="name">${d.name} </div>` +
      `<div class="value">${this.valueLabel(d)}</div>` +
      '</div>';
  }
}

module.exports = WorldMap;
