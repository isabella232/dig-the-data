'use strict';

const d3 = require('d3');
const logger = require('./logger');
const Chart = require('./d3chart');

class LineChart extends Chart {
  constructor(selector, options = {}) {
    super(selector, options);

    this.margin = Object.assign({
      top: 30, right: 30, bottom: 30, left: 40
    }, options.margin || {});

    this.markers = Object.assign({
      show: true
    }, options.markers || {});

    this.guideline = Object.assign({
      show: true
    }, options.guideline || {});

    this.valueFormatter = options.valueFormatter || (v => (v || 0).toLocaleString());
    this.updateDuration = 400;
    this.title = options.title || '';
    this.ticks = options.ticks || d3.utcDay;
    this.tickFormat = options.tickFormat || d3.timeFormat('%d');

    this.chartContainer = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Prepare the axes containers so they can be selected during the data update.
    this.xAxisContainer = this.chartContainer.append('g')
      .classed('axis axis-x', true);
    this.yAxisContainer = this.chartContainer.append('g')
      .classed('axis axis-y', true);
    this.yAxisNameContainer = this.chartContainer.append('text')
      .classed('axis-y-name', true);
    this.titleContainer = this.chartContainer.append('text')
      .classed('chart-title', true);
    this.lineContainer = this.chartContainer.append('g')
      .classed('lines', true);

    // Create a container for the interactive guideline as well as an overlay
    // and vertical line. These might never be needed, but it's convenient to
    // have them here.
    this.guideContainer = this.chartContainer.append('g')
      .classed('guide', true);
    this.guideContainer.append('line')
      .attr('opacity', 0);
    this.guideOverlay = this.chartContainer.append('rect')
      .attr('fill', 'none')
      .attr('pointer-events', 'all');
  }

  update(data) {
    this.resize();

    const chartHeight = this.height - this.margin.top - this.margin.bottom;
    const chartWidth = this.width - this.margin.left - this.margin.right;

    if (data.length) this.hideNoData();
    else {
      this.showNoData('No data for line graph');
      return;
    }

    const allX = data.reduce((a, series) => a.concat(series.map(d => d.x)), []);
    const allY = data.reduce((a, series) => a.concat(series.map(d => d.y)), []);

    const x = d3.scaleTime()
      .rangeRound([0, chartWidth])
      .domain(d3.extent(allX));

    // The y scale should always start at 0 to avoid confusion. To make sure the
    // line is as "centered" as possible, extra space is added to the maximum
    // y-value corresponding to the space below the graph, which is essentially
    // the minimum y-value.
    const minY = d3.min(allY);
    let maxY = d3.max(allY);
    if (minY > 0) {
      maxY += minY;
    }
    const y = d3.scaleLinear()
      .rangeRound([chartHeight, 0])
      .domain([0, maxY]);

    const lineGen = d3.line()
      .x(d => x(d.x))
      .y(d => y(d.y))
      .curve(d3.curveMonotoneX);

    logger.debug('Line domain', x.domain(), y.domain());

    // Prepare the axes.
    this.xAxisContainer
      .attr('transform', `translate(0, ${chartHeight})`)
      .transition('line-x-axis')
      .duration(this.updateDuration)
      .call(d3.axisBottom(x)
        .ticks(this.ticks)
        .tickFormat(this.tickFormat)
      );

    this.yAxisContainer
      .transition('line-y-axis')
      .duration(this.updateDuration)
      .call(d3.axisLeft(y));
    this.yAxisNameContainer
      .attr('y', -(this.margin.top / 2))
      .attr('text-anchor', 'middle')
      .attr('opacity', 0)
      .text(this.yName)
      .transition('line-y-name')
      .delay(this.updateDuration + 50) // Allow the yaxis to be fully animated.
      .duration(this.updateDuration)
      .attr('opacity', 1);

    this.titleContainer
      .attr('x', chartWidth / 2)
      .attr('y', -(this.margin.top / 2))
      .attr('text-anchor', 'middle')
      .attr('opacity', 0)
      .text(this.title)
      .transition('line-title')
      .delay(this.updateDuration + 50) // Allow the yaxis to be fully animated.
      .duration(this.updateDuration)
      .attr('opacity', 1);

    // Create and remove line containers as necessary.
    const series = this.lineContainer.selectAll('g')
      .data(data);
    const seriesEnter = series.enter().append('g');
    series.exit().remove();
    const seriesMerged = series.merge(seriesEnter);

    // Create the actual lines to draw, one for each series
    const pathsUpdate = seriesMerged.selectAll('path')
      .data(d => [d]);
    const pathsEnter = pathsUpdate.enter();
    pathsEnter.append('path')
      .classed('line', true)
      .attr('stroke-dasharray', `${chartWidth} ${chartWidth}`)
      .attr('stroke-dashoffset', chartWidth)
      .attr('d', d => lineGen(d))
      .transition('line-path-enter')
      .duration(this.updateDuration)
      .attr('stroke-dashoffset', 0)
      .on('end', function() {
        d3.select(this)
          .attr('stroke-dashoffset', null)
          .attr('stroke-dasharray', null);
      });

    pathsUpdate
      .transition('line-path-update')
      .duration(this.updateDuration)
      .attr('d', d => lineGen(d));

    if (this.markers.show) {
      // Create circles as markers for the data points.
      const pointsUpdate = seriesMerged.selectAll('circle')
        .data(d => d);
      const pointsEnter = pointsUpdate.enter();
      pointsEnter.append('circle')
        .classed('point', true)
        .attr('r', 3)
        .attr('cx', d => x(d.x))
        .attr('cy', d => y(d.y));
    }

    if (this.guideline.show) {
      const guideline = this.guideContainer.select('line');
      guideline.attr('y1', 0)
        .attr('y2', chartHeight);

      const bisect = d3.bisector(d => d.x).right;

      const dateBisect = (x0, series) => {
        const i = bisect(series, x0, 1);
        const d0 = series[i - 1];
        const d1 = series[i];
        return x0 - d0.x > d1.x - x0 ? d1 : d0;
      };

      const lineChart = this;
      this.guideOverlay
        .attr('width', chartWidth)
        .attr('height', chartHeight)
        .on('mouseover', () => {
          guideline.attr('opacity', undefined);
          this.guideContainer.selectAll('circle').attr('opacity', undefined);
          this.guideContainer.selectAll('text').attr('opacity', undefined);
        })
        .on('mouseout', () => {
          guideline.attr('opacity', 0);
          this.guideContainer.selectAll('circle').attr('opacity', 0);
          this.guideContainer.selectAll('text').attr('opacity', 0);
        })
        .on('mousemove', function() {
          const x0 = x.invert(d3.mouse(this)[0]);

          // Bisect with the first data series to get the correct x-coord.
          const d = dateBisect(x0, data[0]);

          // Update the guideline position.
          guideline.attr('x1', x(d.x))
            .attr('x2', x(d.x));

          // Update the circle position for each series.
          const points = data.map(series => {
            const d = dateBisect(x0, series);
            return d;
          });

          const markers = lineChart.guideContainer.selectAll('g.marker')
            .data(points);
          const markersEnter = markers.enter().append('g');
          markersEnter.classed('marker', true);
          markersEnter.append('circle')
              .data(d => [d])
              .attr('r', 3);
          markersEnter.append('text')
            .data(d => [d]);
          const markersMerged = markers.merge(markersEnter);
          markersMerged
            .attr('transform', `translate(${x(d.x)}, ${y(d.y)})`)
            .select('text')
              .attr('dx', 10)
              .attr('dy', 5)
              .attr('text-anchor', 'left')
              .text(d => lineChart.valueFormatter(d.y));
          markers.exit().remove();
        });
    }
  }
}

module.exports = LineChart;
