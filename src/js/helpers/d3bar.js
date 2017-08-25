'use strict';

// Assumes global jquery.

const d3 = require('d3');
const logger = require('./logger');
const Chart = require('./d3chart');

class BarChart extends Chart {
  constructor(selector, options = {}) {
    super(selector);

    this.margin = Object.assign({
      top: 20, right: 20, bottom: 30, left: 40
    }, options.margin || {});

    this.labels = Object.assign({
      rotate: false
    }, options.labels || {});

    this.label = options.label || (d => d.label);
    this.value = options.value || (d => d.value);
    this.valueFormatter = options.valueFormatter || (v => (v || 0).toLocaleString());
    this.updateDuration = 400;
    this.yName = options.yName || '';

    // The default data sort compares labels.
    this.sort = options.sort || ((a, b) => this.label(a).localeCompare(this.label(b)));

    this.chartContainer = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Prepare the axes containers so they can be selected during the data update.
    this.xAxis = this.chartContainer.append('g')
      .classed('axis axis-x', true);
    this.yAxis = this.chartContainer.append('g')
      .classed('axis axis-y', true);
    this.yAxisName = this.chartContainer.append('text')
      .classed('axis-y-name', true);
  }

  update(data) {
    this.resize();

    data = data.sort(this.sort);

    const chartHeight = this.height - this.margin.top - this.margin.bottom;
    const chartWidth = this.width - this.margin.left - this.margin.right;

    const x = d3.scaleBand()
      .padding(0.1) // 10% padding
      .rangeRound([0, chartWidth])
      .domain(data.map(this.label));

    const y = d3.scaleLinear()
      .rangeRound([chartHeight, 0])
      .domain([0, d3.max(data, this.value)]);

    logger.debug('Bar domain', x.domain(), y.domain());

    // Helper for hovering a specific bar when hovering over a text label
    // Returns the data point for the bar.
    const hoverBar = (selectedLabel, hovering) => {
      return this.chartContainer.selectAll('g.bar rect')
        .filter(d => this.label(d) === selectedLabel)
        .classed('hover', hovering)
        .datum();
    };

    // Helper for hovering a specific text label when hovering a bar.
    const hoverLabel = (selectedBar, hovering) => {
      this.xAxis.selectAll('text')
        .filter(d => d === this.label(selectedBar))
        .classed('hover', hovering);
    };

    // Prepare the axes.
    this.xAxis
      .attr('transform', `translate(0, ${chartHeight})`)
      .transition('bar-x')
      .duration(this.updateDuration)
      .call(d3.axisBottom(x));

    const barChart = this;

    const className = d => {
      const label = typeof d === 'string' ? d : this.label(d);
      return label.toLowerCase().replace(/[^\w]+/g, '_');
    };

    this.xAxis.selectAll('text')
      .attr('class', d => className(d))
      .on('mouseover', function(d) {
        // For x-axis text, the data point is the label.
        d3.select(this).classed('hover', true);
        const selectedData = hoverBar(d, true);
        barChart.tooltip.style('display', null)
          .transition().duration(300)
          .style('opacity', 0.9);
        barChart.tooltip.html(barChart.tooltipText(selectedData));
      })
      .on('mousemove', () => {
        barChart.tooltip.style('left', `${d3.event.pageX}px`).style('top', `${d3.event.pageY + 28}px`);
      })
      .on('mouseout', function(d) {
        d3.select(this).classed('hover', false);
        hoverBar(d, false);
        barChart.tooltip.style('opacity', 0).style('display', 'none');
      })
      .on('click', d => this.trigger('label.click', d));

    if (this.labels.rotate) {
      this.xAxis.selectAll('text')
        .attr('text-anchor', 'end')
        .attr('dx', '-1em')
        .attr('dy', 0)
        .attr('transform', 'rotate(-65)');
    }
    this.yAxis
      .transition('bar-y')
      .duration(this.updateDuration)
      .call(d3.axisLeft(y));
    this.yAxisName
      .attr('y', -(this.margin.top / 2))
      .attr('text-anchor', 'middle')
      .attr('opacity', 0)
      .text(this.yName)
      .transition('bar-y-name')
      .delay(this.updateDuration + 50) // Allow the yaxis to be fully animated.
      .duration(this.updateDuration)
      .attr('opacity', 1);

    // Select bars
    const barsUpdate = this.chartContainer.selectAll('g.bar')
      .data(data);

    // Make sure the bar children know about the new data.
    barsUpdate.selectAll('rect').data(d => [d]);

    // Create new bars
    const barsEnter = barsUpdate.enter().append('g')
      .classed('bar', true);
    barsEnter.append('rect')
      .attr('x', d => x(this.label(d)))
      .attr('y', chartHeight)
      .attr('width', x.bandwidth())
      .attr('height', 0)
      .attr('class', d => className(d));

    // Existing bars and new bars merged.
    const barsMerged = barsEnter.merge(barsUpdate);

    // Now animate to the new heigh and location of the top.
    barsMerged
      .selectAll('rect')
      .transition('bar-height')
      .duration(400)
      .attr('height', d => chartHeight - y(this.value(d)))
      .attr('y', d => y(this.value(d)));

    barsMerged
      .selectAll('rect')
      .on('mouseover', function(d) {
        // For x-axis text, the data point is the label.
        d3.select(this).classed('hover', true);
        hoverLabel(d, true);
        barChart.tooltip.style('display', null)
          .transition().duration(300)
          .style('opacity', 0.9);
        barChart.tooltip.html(barChart.tooltipText(d));
      })
      .on('mousemove', () => {
        barChart.tooltip.style('left', `${d3.event.pageX}px`).style('top', `${d3.event.pageY + 28}px`);
      })
      .on('mouseout', function(d) {
        d3.select(this).classed('hover', false);
        hoverLabel(d, false);
        barChart.tooltip.style('opacity', 0).style('display', 'none');
      })
      .on('click', d => this.trigger('bar.click', d));
  }

  tooltipText(d) {
    return '<div class="bar-tip">' +
      `<div class="name">${this.label(d)} </div>` +
      `<div class="value">${this.valueFormatter(this.value(d))}</div>` +
      '</div>';
  }
}

module.exports = BarChart;
