'use strict';

const d3 = require('d3');
const logger = require('./logger');

/**
 * A minimal base class for with some common functionality such as width and
 * height calculations and resizing.
 */
class Chart {
  constructor(selector, options = {}) {
    this.selector = selector;
    this.svg = d3.select(selector);
    this.dom = $(selector);
    this.tooltip = options.tooltip || d3.select('#tooltip');
    this.noData = options.noData || 'No Data';
    this.resize();
  }

  on(eventName, fun) {
    this.dom.on(eventName, fun);
  }

  trigger(eventName, ...args) {
    this.dom.trigger(eventName, args);
  }

  resize() {
    // Use jquery for width and height fetching.
    [this.width, this.height] = [this.dom.width(), this.dom.height()];
    logger.debug('SVG dimensions', this.width, this.height);
  }

  showNoData() {
    // Make sure previous elements are gone.
    this.hideNoData();

    let noData = this.svg.select('g.no-data');
    if (!noData.length) noData = this.svg.append('g').classed('no-data', true);

    noData.append('rect')
      .attr('width', this.width)
      .attr('height', this.height);

    noData.append('text')
      .attr('x', this.width / 2)
      .attr('y', this.height / 2)
      .attr('text-anchor', 'middle')
      .text(this.noData);
  }

  hideNoData() {
    // Selecting the svg does not always remove the element. Let's rely on the dom instead.
    this.dom.find('g.no-data').remove();
  }
}

module.exports = Chart;
