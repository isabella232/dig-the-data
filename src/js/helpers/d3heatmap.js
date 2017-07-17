'use strict';

// Assumes global jquery and d3.

const logger = require('./logger');
const vars = require('../../shared/variables.json');

const dayFormatter = d3.utcFormat('%a');

/**
 * Returns a day-of-week label (e.g. "Mon") for the given day-of-week number with Monday starting at
 * 0, because #rebels.
 * @param {Number} dow - Day of the week, Monday is 0, Sunday is 6.
 * @returns {String}
 */
const dayOfWeekText = dow => {
  // To possibly support locales, let's use real dates for the weekdays.
  // February 20, 2017 was a Monday :-)
  return dayFormatter(Date.UTC(2017, 1, 20 + dow));
};

/**
 * Returns a day-of-week and hour label (e.g. "Mon 12:00") for the given day-of-week number with
 * Monday starting at 0, because #rebels.
 * @param {Number} dow - Day of the week, Monday is 0, Sunday is 6.
 * @param {Number} hour - The hour of the day.
 * @returns {String}
 */
const dayOfWeekAndHourText = (dow, hour) => {
  // To possibly support locales, let's use real dates for the weekdays.
  // February 20, 2017 was a Monday :-)
  const dayOfWeek = dayFormatter(Date.UTC(2017, 1, 20 + dow, hour, 0));
  const end = hour === 23 ? 0 : hour + 1;
  const hourInterval = `${hour}:00 - ${end}:00`;
  return `${dayOfWeek}, ${hourInterval}`;
};

class HeatMap {
  constructor(selector, options = {}) {
    this.selector = selector;
    this.svg = d3.select(selector);
    this.dom = $(selector);
    this.resize();

    // Set default margins.
    this.margin = { top: 35, right: 50, bottom: 35, left: 50 };

    // For the defaults, assume the values "dow", "hour" and "cnt" for the map.
    this.value = options.value || (d => d.cnt);
    this.xValue = options.xValue || (d => d.hour);
    this.yValue = options.yValue || (d => d.dow);

    this.valueLabel = options.valueLabel || (d => (d.cnt || 0).toLocaleString());
    this.xLabel = options.xLabel || (d => String(d));
    this.yLabel = options.yLabel || (d => dayOfWeekText(d-1));

    this.fromColor = options.fromColor || vars.$gray;
    this.toColor = options.toColor || vars.$orange;

    this.tooltip = options.tooltip || d3.select('#tooltip');
    this.tooltipLabel = options.tooltipLabel || (d => dayOfWeekAndHourText(d.dow-1, d.hour));

    this.gradient = this.svg.append('defs')
      .append('linearGradient')
      .attr('id', 'heat-gradient');

    this.gradient.append('stop')
      .attr('offset', '5%')
      .attr('stop-color', this.fromColor);
    this.gradient.append('stop')
      .attr('offset', '95%')
      .attr('stop-color', this.toColor);

    // Create the heat-map grouping.
    this.heatMap = this.svg.append('g')
      .classed('grid', true)
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.xAxis = this.svg.append('g')
      .classed('x-axis', true);
    this.yAxis = this.svg.append('g')
      .classed('y-axis', true);
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
    logger.debug('Heatmap SVG dimensions', this.width, this.height);
  }

  update(data) {
    logger.debug(`Updating heatmap with ${data.length} data points`);
    this.resize();

    // Sort the data, otherwise dynamic updates will be out-of-place.
    // This assumes that the shape and type of the input data stays the same.
    data.sort((a, b) => {
      const xSort = this.xValue(a) - this.xValue(b);
      if (xSort !== 0) return xSort;
      return this.yValue(a) - this.yValue(b);
    });

    // Create the update selection for the heat-cubes
    const mapUpdate = this.heatMap
      .selectAll('g')
      .data(data);

    // Make sure the rectangles inherit the updated data.
    mapUpdate.selectAll('rect').data(d => [d]);

    const xValues = Array.from(new Set(data.map(this.xValue))).sort((a, b) => a - b);
    const yValues = Array.from(new Set(data.map(this.yValue))).sort((a, b) => a - b);

    logger.debug('x', xValues, 'y', yValues);

    const heatWidth = this.width - this.margin.left - this.margin.right;
    const heatHeight = this.height - this.margin.top - this.margin.bottom;
    const cubeWidth = heatWidth / xValues.length;
    const cubeHeight = heatHeight / yValues.length;

    logger.debug('Dimensions', heatWidth, heatHeight, cubeWidth, cubeHeight);

    const [domainFrom, domainTo] = d3.extent(data, this.value);

    const colorScale = d3.scaleLinear()
      .domain([domainFrom, domainTo])
      .range([this.fromColor, this.toColor]);

    const mapEnter = mapUpdate.enter().append('g');

    // Add new cubes
    mapEnter
      .attr('transform', d => {
        const x = xValues.indexOf(this.xValue(d)) * cubeWidth;
        const y = yValues.indexOf(this.yValue(d)) * cubeHeight;
        return `translate(${x},${y})`;
      })
      .append('rect')
      .classed('heat-entry', true)
      .attr('width', cubeWidth)
      .attr('height', cubeHeight)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', d => colorScale(this.value(d)));

    // Update the fill-color of the rectangle
    // Note: This will only be called when updating rectangles.
    mapUpdate.selectAll('rect')
      .transition().duration(300)
      .attr('fill', d => colorScale(this.value(d)));

    // Merge the enter and update selections so we can set tooltips on everything.
    const mapMerged = mapEnter.merge(mapUpdate);
    const _this = this;
    mapMerged
      .on('mouseover', function(d) {
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
      })
      .on('click', d => this.trigger('cell.click', d));

    // Add the legend
    const legendUpdate = this.svg.selectAll('g.legend')
      .data([0]); // Pseudo-data, to create a single enter event.

    const legendEnter = legendUpdate.enter();
    const container = legendEnter
      .append('g')
      .classed('legend', true)
      .attr('transform', `translate(${heatWidth / 2 + this.margin.left}, ${this.height - this.margin.bottom + 10})`);

    const legendWidth = Math.max(100, heatWidth / 4);
    container.append('rect')
      .attr('x', -legendWidth / 2)
      .attr('width', legendWidth)
      .attr('height', this.margin.bottom - 10)
      .attr('fill', 'url(#heat-gradient)');
    container.append('text')
      .classed('from', true)
      .attr('x', -legendWidth / 2 - 7)
      .attr('y', this.margin.bottom / 2)
      .attr('text-anchor', 'end')
      .text(domainFrom.toLocaleString());
    container.append('text')
      .classed('to', true)
      .attr('x', legendWidth / 2 + 7)
      .attr('y', this.margin.bottom / 2)
      .attr('text-anchor', 'start')
      .text(domainTo.toLocaleString());

    legendUpdate.merge(legendEnter)
      .selectAll('text')
      .data([domainFrom, domainTo])
      .transition().duration(300)
      .tween('text', function(d) {
        const prev = this._prev || 0;
        const _this = d3.select(this);
        const i = d3.interpolateNumber(prev, d);
        return t => _this.text(Math.round(i(t)).toLocaleString());
      })
      .on('end', function(d) {
        this._prev = d;
      });

    // Add labels
    const xLabels = this.xAxis.selectAll('g')
      .data(xValues);

    const yLabels = this.yAxis.selectAll('g')
      .data(yValues);

    xLabels.enter()
      .append('g')
      .classed('x-label', true)
      .attr('transform', (d, i) => {
        const x = this.margin.left + cubeWidth * i + cubeWidth / 2;
        const y = this.margin.top - 10;
        return `translate(${x},${y})`;
      })
      .append('text')
      .attr('text-anchor', 'middle')
      .text(d => this.xLabel(d));

    yLabels.enter()
      .append('g')
      .classed('y-label', true)
      .attr('transform', (d, i) => {
        const x = this.margin.left - 10;
        const y = this.margin.top + cubeHeight * i + cubeHeight / 2;
        return `translate(${x},${y})`;
      })
      .append('text')
      .attr('dy', 3)
      .attr('text-anchor', 'end')
      .text(d => this.yLabel(d));
  }

  tooltipText(d) {
    return '<div class="heat-tooltip">' +
      `<div class="name"> ${this.tooltipLabel(d)}</div>` +
      `<div class="value">${this.valueLabel(d)}</div>` +
      '</div>';
  }
}

module.exports = HeatMap;
