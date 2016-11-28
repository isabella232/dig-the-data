'use strict';

// Assumes global jquery and d3.

class PieChart {
  constructor(selector, options = {}) {
    // Set options
    this.transition = options.transition;
    this.extent = options.extent;
    this.value = options.value || (d => d.value);
    this.valueFormat = options.valueFormat || (val => val.toLocaleString());
    this.label = options.label || (d => d.label);
    this.description = options.description || this.label;
    this.color = Object.assign({
      scheme: d3.schemeCategory10,
      labels: false,
      lines: false
    }, options.color || {});
    this.center = Object.assign({ showLabel: true }, options.center || {});

    this.enterDuration = 700;
    this.updateDuration = 300;
    this.exitDuration = 300;
    if (!this.transition) {
      // Setting a transition to 0 ms duration actually works ok, but it's probably suboptimal...
      this.enterDuration = this.updateDuration = this.exitDuration = 0;
    }

    // Select svg element and calculate base properties.
    this.svg = d3.select(selector);
    const $donutSvg = $(selector);
    [this.width, this.height] = [$donutSvg.width(), $donutSvg.height()];
    [this.x, this.y] = [this.width / 2, this.height / 2];
    this.radius = Math.min(this.width, this.height) / 2;

    // Create an arc constructor for
    // - The main pie (Provides some margin if needed)
    // - The labeler (Works like a donut)
    // - The outer layer (The margin)
    const outer = this.radius;
    const middle = this.radius * 0.85;
    const inner = this.radius * 0.5;

    this.arc = d3.arc().innerRadius(0).outerRadius(middle);
    this.donutArc = d3.arc().innerRadius(inner).outerRadius(middle);
    this.marginArc = d3.arc().innerRadius(middle).outerRadius(outer);

    // Calculate arcs. For a single-valued dataset, this will be a full circle.
    this.pie = d3.pie().value(this.value);

    this.reset();
  }

  /**
   * Utility function for updating the pie center text for a single data point.
   * @param {Object} d - Data point
   */
  _updatePieCenter(d) {
    const text = this.svg.select('.center-label text');
    text.selectAll('tspan').remove();

    const valueSpan = text.append('tspan')
      .attr('x', 0)
      .classed('value', true)
      .text(this.valueFormat(this.value(d)));
    if (this.center.showLabel) {
      text.append('tspan')
        .classed('small', true)
        .attr('x', 0)
        .attr('dy', '16px')
        .text(this.label(d));

      // Adjust text dy based on the bounding box.
      const bbox = text.node().getBBox();
      text.attr('dy', '-' + (bbox.height / 4) + 'px');
    }

    if (this.color.labels && d.arc.color) {
      text.style('fill', d.arc.color);
    }
  };

  /**
   * Updates this pie chart with the given data
   * @param {Array} data - The new data
   */
  update(data) {
    let enterDelay = 0;
    let updateDelay = 0;

    // Easier access to certain function from closure functions...
    const arc = this.arc;
    const donutArc = this.donutArc;
    const marginArc = this.marginArc;

    // Calculate the correct arcs for the pie.
    const arcs = this.pie(data);
    data.forEach((d, i) => {
      d.arc = arcs[i];
      d.arc.color = this.color.scheme[i];
    });

    // Create the update selection for the pie slices
    const gUpdate = this.svg.select('g .slices')
      .selectAll('g')
      .data(data);

    // Make sure paths, polylines and texts have updated data from the parent g
    // group. Note to self: This is one of the slightly weird and often
    // annoying parts of d3 that data is not automatically inherited to
    // children. There is probably a good reason for this though.
    gUpdate.selectAll('path').data(d => [d]);
    gUpdate.selectAll('polyline').data(d => [d]);
    gUpdate.selectAll('text').data(d => [d]);

    // Delete old elements as needed
    const gExit = gUpdate.exit();

    // Delete pies over time by fading out the paths that make up the pie
    // slices.
    gExit.selectAll('text, polyline').remove();
    gExit.transition().duration(this.exitDuration).remove()
      .selectAll('path')
        .attr('fill', d => {
          const c = d3.color(d.arc.color);
          c.opacity = 0;
          return c;
        });

    // Allow updating and exiting nodes time to animate.
    if (gExit.size() > 0) {
      enterDelay += this.exitDuration;
      updateDelay += this.exitDuration;
    }

    if (gUpdate.size() > 0) {
      enterDelay += this.updateDuration;
    }

    // Create new g groups as needed
    const gEnter = gUpdate.enter().append('g');

    // Create new paths as needed
    gEnter.append('path')
      .attr('fill', d => {
        const c = d3.color(d.arc.color);
        c.opacity = 0;
        return c;
      })
      .attr('d', d => donutArc(d.arc))
      .transition('pie-enter')
      .delay(enterDelay)
      .duration(this.enterDuration)
      .attr('fill', d => d.arc.color)
      .each(function(d) { this._arc = d.arc; });

    // Append a label and label line.
    gEnter.append('polyline').classed('.label-line', true);
    gEnter.append('text').classed('.label-text', true);

    // Update existing paths by interpolating their start and end angles if transitioning is
    // enabled.
    gUpdate.selectAll('path')
      .transition('pie-update')
      .delay(updateDelay)
      .duration(this.updateDuration)
      .attrTween('d', function(d) {
        // If there is already an arc present, interpolate between the old
        // and new end-angle. Otherwise interpolate from start to end
        const interpolateStart = d3.interpolate(
          this._arc ? this._arc.startAngle : d.startAngle,
          d.arc.startAngle
        );
        const interpolateEnd = d3.interpolate(
          this._arc ? this._arc.endAngle : d.startAngle,
          d.arc.endAngle
        );

        // Update the arc
        this._arc = d.arc;

        // Return a time-sensitive function that returns the path for each
        // duration step.
        return t => {
          d.arc.startAngle = interpolateStart(t);
          d.arc.endAngle = interpolateEnd(t);
          return donutArc(d.arc);
        };
      });

    // Set attributes for both new and updated elements
    const gMerged = gEnter.merge(gUpdate).classed('arc-container', true);
    gMerged.selectAll('path').classed('arc', true);

    const labelCenter = d => {
      const center = this.marginArc.centroid(d.arc);
      if (center[0] > 0) {
        center[0] = this.radius + 10;
      } else {
        center[0] = 0 - this.radius - 10;
      }

      return center;
    };

    const opacityAccessor = d => this.value(d) === 0 ? 0 : 1

    // Create the polyline that goes to the text label.
    const lines = gMerged.selectAll('polyline')
      .attr('stroke-opacity', 0)
      .attr('points', d => {
        const end = labelCenter(d);
        if (end[0] > 0) end[0] -= 10;
        else end[0] += 10;
        return [donutArc.centroid(d.arc), marginArc.centroid(d.arc), end];
      })

    if (this.color.lines) {
      // Use style in case there was a CSS override.
      // Normal stroke attribute will not override CSS.
      lines.style('stroke', d => d.arc.color);
    }

    lines
      .transition('pie-label-lines')
      .delay(enterDelay)
      .duration(this.enterDuration)
      .attr('stroke-opacity', opacityAccessor);

    // Update the text label
    const labels = gMerged.selectAll('text')
      .attr('fill-opacity', 0)
      .text(this.label)
      .attr('dy', '4px')
      .attr('transform', d => `translate(${labelCenter(d)})`)
      .attr('text-anchor', d => {
        // Find the center of the donut arc
        if (labelCenter(d)[0] > 0) return 'start';
        return 'end';
      });

    if (this.color.labels) {
      // Use style in case there was a CSS override.
      // Normal stroke attribute will not override CSS.
      labels.style('fill', d => d.arc.color);
    }

    labels
      .transition('pie-label-text')
      .delay(enterDelay)
      .duration(this.enterDuration)
      .attr('fill-opacity', opacityAccessor);

    // Set mouseover hover events.
    gMerged.selectAll('path')
      .on('mouseover', function(d, i) {
        const path = d3.select(this);
        path.classed('hover', true);
      })
      .on('mousemove', d => this._updatePieCenter(d))
      .on('mouseout', function(d, i) {
        d3.select(this).classed('hover', false);
      });
  }

  reset() {
    this.svg.selectAll('g').remove();

    // Make sure the outer grouping is in the right spot
    const outerG = this.svg.append('g')
      .attr('transform', `translate(${this.width/2},${this.height/2})`);


    // Ensure slice and label containers
    if (outerG.select('.slices').size() === 0) {
      outerG.append('g').classed('slices', true);
      outerG.append('g')
        .classed('center-label', true)
        .append('text')
          .attr('text-anchor', 'middle');
      outerG.append('g')
        .classed('description-label', true)
        .append('text');
    }

    // Make sure existing center text is removed
    outerG.select('.center-label text').selectAll('tspan').remove();
  }
}

module.exports = PieChart;
