(function($, d3, venn) {
  'use strict';

  var dataRaw;
  var currentView = 0;
  var width = 600;
  var height = 350;
  var svg = d3.select('#svg-container svg');
  svg.append('g');

  var debug = function() {
    console.log.apply(null, arguments);
  };

  var getConversions = function(d) {
    return d.size.toLocaleString('en-US');
  };

  var getRevenue = function(d) {
    return d.revenue
      .toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  var tooltipText = function(d) {
    return '<h5>' + d.label + '</h5>' +
      '<div>' + d.size + '</div>' +
      '<div class="small margin">Conversions</div>' +
      '<div>' + getRevenue(d) + '</div>' +
      '<div class="small">Revenue Generated</div>';
  };

  var addEvents = function() {
    return;
    var tooltip = d3.select('.tooltip');

    svg.selectAll('path')
      .on('mouseover', function(d, i) {
        var path = d3.select(this);

        // If the path is a venn element, then sort the areas relative to the
        // current path so we can figure out which one is "on top".
        // TODO: This might not be needed at all.
        if (path.classed('venn')) {
          // Sort all the areas relative to the current item
          venn.sortAreas(svg, d);
        }

        // Display the tooltip
        tooltip.style('display', null)
          .transition().duration(300).style('opacity', .9);
        tooltip.html(tooltipText(d));

        // Hover on the current path (the circle itself)
        path.classed('hover', true);
      })
      .on('mousemove', function() {
        tooltip.style('left', (d3.event.pageX) + 'px')
          .style('top', (d3.event.pageY + 28) + 'px');
      })
      .on('mouseout', function(d, i) {
        tooltip.style('opacity', 0)
          .style('display', 'none');
        d3.select(this).classed('hover', false);
      });
  };

  var calculateCircle = function() {
    return {
      x: width / 2,
      y: height / 2,
      radius: Math.min(width, height) / 2
    };
  };

  var dataKey = function(d, i) {
    return d.label;
  };

  var enterDuration = 700;
  var updateDuration = 300;
  var exitDuration = 300;

  var updatePieCenter = function(d) {
    var text = svg.select('.center-label text');
    text.selectAll('tspan').remove();

    // Conversions
    text.append('tspan')
      .attr('x', 0)
      .text(getConversions(d));
    text.append('tspan')
      .classed('small', true)
      .attr('x', 0)
      .attr('dy', '16px')
      .text('Conversions');

    // Revenue
    text.append('tspan')
      .attr('x', 0)
      .attr('dy', '24px')
      .text(getRevenue(d))
    text.append('tspan')
      .classed('small', true)
      .attr('x', 0)
      .attr('dy', '16px')
      .text('Revenue Generated');

    // Adjust text dy based on the bounding box.
    var bbox = text.node().getBBox();
    text.attr('dy', '-' + (bbox.height / 3) + 'px');
  };

  var pieEvents = function() {
    svg.selectAll('path')
      .on('mouseover', function(d, i) {
        var path = d3.select(this);

        // If the path is a venn element, then sort the areas relative to the
        // current path so we can figure out which one is "on top".
        // TODO: This might not be needed at all.
        if (path.classed('venn')) {
          // Sort all the areas relative to the current item
          venn.sortAreas(svg, d);
        }

        // Update the pie center
        updatePieCenter(d);

        // Hover on the current path (the circle itself)
        path.classed('hover', true);
      })
      .on('mouseout', function(d, i) {
        d3.select(this).classed('hover', false);
      });
  };

  var pieDescription = function(data) {
    $('#description h3').text(data.name);
    $('#description p').text(data.description);
  };

  var showOnePie = function(pieData) {
    var data = pieData.datasets;

    var enterDelay = 0;
    var updateDelay = 0;

    // Calculate a full circle arc that would fit inside the current svg
    // element.
    var circleInfo = calculateCircle();

    // Create an arc constructor for
    // - The main pie (Provides some margin if needed)
    // - The labeler (Works like a donut)
    // - The outer layer (The margin
    var outer = circleInfo.radius;
    var middle = circleInfo.radius * 0.8;
    var inner = circleInfo.radius * 0.5;

    var arc = d3.arc().innerRadius(0).outerRadius(middle);
    var donutArc = d3.arc().innerRadius(inner).outerRadius(middle);
    var marginArc = d3.arc().innerRadius(middle).outerRadius(outer);

    // Calculate arcs. For a single-valued dataset, this will be a full circle.
    var pie = d3.pie().value(function(d) { return d.size; });
    var arcs = pie(data);

    var total = data.reduce(function(acc, d) { return acc + d.size; }, 0);

    data.sort(function(a, b) { return b.size - a.size; })
      .forEach(function(d, i) {
        d.arc = arcs[i];
        d.arc.color = d3.schemeCategory10[i];
        d.percentage = d.size / total * 100;
      });

    // Make sure the outer grouping is in the right spot
    var outerG = svg.select('g')
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

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

    if (data.length === 1) {
      updatePieCenter(data[0]);
    }

    // Create the update selection for the pie slices
    var gUpdate = svg.select('g .slices')
      .selectAll('g')
      .data(data);

    // Make sure paths, polylines and texts have updated data from the parent g
    // group. Note to self: This is one of the slightly weird and often
    // annoying parts of d3 that data is not automatically inherited to
    // children. There is probably a good reason for this though.
    gUpdate.selectAll('path')
      .data(function(d) { return [d]; });

    gUpdate.selectAll('polyline')
      .data(function(d) { return [d]; });

    gUpdate.selectAll('text')
      .data(function(d) { return [d]; });

    // Delete old elements as needed
    var gExit = gUpdate.exit();

    // Delete pies over time by fading out the paths that make up the pie
    // slices.
    gExit.selectAll('text, polyline').remove();
    gExit.transition().duration(exitDuration).remove()
      .selectAll('path')
        .attr('fill', function(d) {
          var c = d3.color(d.arc.color);
          c.opacity = 0;
          return c;
        });

    // Allow updating and exiting nodes time to animate.
    if (gExit.size() > 0) {
      enterDelay += exitDuration;
      updateDelay += exitDuration;
    }

    if (gUpdate.size() > 0) {
      enterDelay += updateDuration;
    }

    // Create new g groups needed
    var gEnter = gUpdate.enter().append('g');

    // Create new paths as needed
    gEnter.append('path')
      .attr('fill', function(d) {
        var c = d3.color(d.arc.color);
        c.opacity = 0;
        return c;
      })
      .attr('d', function(d) { return donutArc(d.arc); })
      .transition('pie-enter')
      .delay(enterDelay)
      .duration(enterDuration)
      .attr('fill', function(d) { return d.arc.color; })
      .each(function(d) {
        this._arc = d.arc;
      });

    // Append a label and label line.
    gEnter.append('polyline').classed('.label-line', true);
    gEnter.append('text').classed('.label-text', true);

    // Update existing paths by interpolating their start and end angles.
    gUpdate.selectAll('path')
      .transition('pie-update')
      .delay(updateDelay)
      .duration(updateDuration)
      .attrTween('d', function(d) {
        // If there is already an arc present, interpolate between the old
        // and new end-angle. Otherwise interpolate from start to end
        var interpolateStart = d3.interpolate(
          this._arc ? this._arc.startAngle : d.startAngle,
          d.arc.startAngle
        );
        var interpolateEnd = d3.interpolate(
          this._arc ? this._arc.endAngle : d.startAngle,
          d.arc.endAngle
        );

        // Update the arc
        this._arc = d.arc;

        // Return a time-sensitive function that returns the path for each
        // duration step.
        return function(t) {
          d.arc.startAngle = interpolateStart(t);
          d.arc.endAngle = interpolateEnd(t);
          return donutArc(d.arc);
        };
      });

    // Set attributes for both new and updated elements
    var gMerged = gEnter.merge(gUpdate).classed('arc-container', true);
    gMerged.selectAll('path').classed('arc', true);

    var labelCenter = function(d) {
      var center = marginArc.centroid(d.arc);
      if (center[0] > 0) {
        center[0] = circleInfo.radius + 10;
      } else {
        center[0] = 0 - circleInfo.radius - 10;
      }

      return center;
    };

    gMerged.selectAll('polyline')
      .attr('stroke-opacity', 0)
      .attr('points', function(d) {
        var end = labelCenter(d);
        if (end[0] > 0) end[0] -= 10;
        else end[0] += 10;
        return [donutArc.centroid(d.arc), marginArc.centroid(d.arc), end];
      })
      .transition('pie-label-lines')
      .delay(enterDelay)
      .duration(enterDuration)
      .attr('stroke-opacity', 1);

    gMerged.selectAll('text')
      .attr('fill-opacity', 0)
      .text(function(d) { return d.label; })
      .attr('dy', '4px')
      .attr('transform', function(d) {
        return 'translate(' + labelCenter(d) + ')';
      })
      .attr('text-anchor', function(d) {
        // Find the center of the donut arc
        if (labelCenter(d)[0] > 0) return 'start';
        return 'end';
      })
      .transition('pie-label-text')
      .delay(enterDelay)
      .duration(enterDuration)
      .attr('fill-opacity', 1);

    pieEvents();
    pieDescription(pieData);

    return {
      update: gUpdate,
      enter: gEnter,
      exit: gExit,
      merged: gMerged
    };
  };

  /**
   * View 1. Showing overall conversions with a nice little circle :-)
   * Assumed that dataRaw and svg has already been set up.
   */
  var showConversions = function() {
    debug('Showing conversions', dataRaw.conversions);
    showOnePie(dataRaw.conversions);
  };

  /**
   * View 2. Showing conversion counts with a pie chart
   */
  var showSourceCounts = function() {
    debug('Showing source counts', dataRaw.sourceCounts);
    showOnePie(dataRaw.sourceCounts);
  };

  /**
   * View 3. Showing different source types
   */
  var showConversionTypes = function() {
    debug('Showing conversion types', dataRaw.conversionTypes);
    showOnePie(dataRaw.conversionTypes);
  };

  /**
   * View 4. Showing different email source types
   */
  var showEmailTypes = function() {
    debug('Showing email types', dataRaw.emailTypes);
    showOnePie(dataRaw.emailTypes);
  };

  /**
   * View 5. Showing different widget source types
   */
  var showWidgetTypes = function() {
    debug('Showing widget types', dataRaw.widgetTypes);
    showOnePie(dataRaw.widgetTypes);
  };

  var showVenn = function() {
    var diagram = venn.VennDiagram();
    diagram.width(width);
    diagram.height(height);

    // Update the data
    svg.select('g')
      .attr('transform', null)
      .datum(data.emailTypes)
      .call(diagram);

    // Add event listeners
    addEvents();
  };

  var showView = function(view) {
    currentView = view || 0;
    debug('Showing view', currentView);

    switch (currentView) {
      case 0:
        showConversions();
        break;
      case 1:
        showSourceCounts();
        break;
      case 2:
        showConversionTypes();
        break;
      case 3:
        showEmailTypes();
        break;
      case 4:
        showWidgetTypes();
        break;
    }
  };

  var rerender = function() {
    showView();
  };

  var fetchData = function() {
    d3.json('/data/october.json', function(data) {
      dataRaw = data;
      debug('Data loaded', dataRaw);

      // TODO
      resize();
    });
  };

  var resize = function() {
    // Calculate the real width and height of the svg
    var e = $('#svg-container svg')

    var oldW = width;
    var oldH = height;

    width = e.width();
    height = e.height();
    debug('New size', width, height);

    if (oldW !== width || oldH !== height) {
      $(window).trigger('votm.newsize');
    }
  };

  $(document).ready(function() {
    $(window).on('resize', resize);
    $(window).on('votm.newsize', rerender);
    fetchData();

    $('#view-selection button').each(function(i) {
      $(this).on('click', function() {
        showView(i);
      });
    });

    $('#view-pager a.prev').on('click', function() {
      showView(currentView - 1);
      return false;
    });

    $('#view-pager a.next').on('click', function() {
      showView(currentView + 1);
      return false;
    });
  });
})(window.jQuery, window.d3, window.venn);
