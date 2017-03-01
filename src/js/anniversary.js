'use strict';

/**
 * Global requirements d3 and jQuery ($). Deliberately not required here :-)
 */

const Player = require('./player'),
  PieChart = require('./d3pie'),
  WorldMap = require('./d3world'),
  logger = require('./logger'),
  vars = require('../shared/variables.json');

let lineWidth = 600;
let lineHeight = 350;
let statusWidth = 200;
let statusHeight = 350;
let player;
let small = false;

const mapGradient = [vars.$navy, vars.$green];

const margin = { top: 35, right: 50, bottom: 35, left: 50 };
const lineSvg = d3.select('#line-container svg');
const lineG = lineSvg.append('g');

const statusSvg = d3.select('#status-container svg');
const statusG = statusSvg.append('g');
const tooltip = d3.select('#tooltip');

const resize = () => {
  small = $(window).width() < 450;
  logger.debug('Small', $(window).width(), small);

  const $lineSvg = $('#line-container svg');
  const $statusSvg = $('#status-container svg');

  lineWidth = $lineSvg.width() - margin.left - margin.right;
  lineHeight = $lineSvg.height() - margin.top - margin.bottom;
  statusWidth = $statusSvg.width() - margin.left - margin.right;
  statusHeight = $statusSvg.height();

  logger.debug('New line size', lineWidth, lineHeight);
  logger.debug('New status size', statusWidth, statusHeight);

  lineSvg.attr('width', lineWidth + margin.left + margin.right)
    .attr('height', lineHeight + margin.top + margin.bottom)
  lineG.attr('transform', `translate(${margin.left},${margin.top})`);

  statusSvg.attr('width', statusWidth + margin.left + margin.right)
    .attr('height', statusHeight + margin.top)
  statusG.attr('transform', `translate(${margin.left},${margin.top})`);
};


const formatCurrency = val => {
  return val.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
};

/**
 * Create a line graph for the given data and sets it up to listen to the global player updates.
 */
const prepareLineGraph = allData => {
  const series = [
    { data: allData.receipts, color: vars.$green },
    { data: allData.followups, color: vars.$lightnavy },
    { data: allData.abandonedcarts, color: vars.$orange }
  ];

  // Use time for x-axis.
  // Use integers for y-axis.
  // Scale to the width and height of the container.
  const x = d3.scaleTime()
    .rangeRound([0, lineWidth]);

  const y = d3.scaleLinear()
    .rangeRound([lineHeight, 0]);

  // Prepare a line-generator.
  const line = d3.line()
    .x(d => x(d.ts))
    .y(d => y(d.rc))
    .curve(d3.curveMonotoneX);

  // Prepare the axes.
  const xAxis = lineG.append('g')
    .classed('axis axis-x', true)
    .attr('transform', `translate(0,${lineHeight})`);
  const yAxis = lineG.append('g')
    .classed('axis axis-y', true);
  yAxis.append('text')
      .attr('fill', '#000')
      .attr('transform', 'rotate(-90)')
      .attr('y', -6)
      .attr('x', -(lineHeight/ 2))
      .attr('text-anchor', 'middle')
      .text('Sent Emails');

  // Create the actual line to draw
  const p = lineG.append('g')
    .classed('lines', true)
    .selectAll('path')
    .data(series);
  const pEnter = p.enter().append('path')
    .classed('line', true)
    .style('stroke', d => d.color);
  const paths = pEnter.merge(p);

  const g = lineG.append('g')
    .classed('line-ends', true)
    .selectAll('g')
    .data(series);
  const gEnter = g.enter().append('g')
    .classed('line-end', true);
  const lineEnds = gEnter.merge(g);
  const circles = lineEnds.append('circle')
    .attr('fill', d => d.color);
  const rects = lineEnds.append('rect')
    .attr('width', 96)
    .attr('height', 30)
    .attr('x', 12)
    .attr('y', -15)
    .attr('rx', 10)
    .attr('ry', 10)
    .attr('fill', 'none')
    .attr('stroke', d => d.color)
    .attr('stroke-width', 3)
    .attr('stroke-opacity', 0);
  const texts = lineEnds.append('text')
    .classed('number', true)
    .attr('width', 96)
    .attr('height', 30)
    .attr('x', 60) // 48 from half-width rect and 12 from rect offset
    .attr('dy', 5)
    .attr('text-anchor', 'middle')
    .attr('fill', d => d.color)
    .attr('fill-opacity', 0)
    .text('0')

  const extents = [
    [1, 1000000],
    [1, d3.max(series[0].data, d => d.rc)]
  ]

  // Create the full x scale.
  x.domain(d3.extent(player.timestamps));
  const ticks = d3.timeMonth.every(small ? 4 : 2);
  const tickFormat = d3.timeFormat('%b %Y');
  xAxis.call(d3.axisBottom(x).ticks(ticks).tickFormat(tickFormat))
    .attr('font-family', '')
    .selectAll('.tick text')
    .each(function() {
      const text = d3.select(this);
      const month = text.text();
      const words = month.split(/\s+/);
      text.text(null)
        .append('tspan')
        .attr('x', 0)
        .text(words[0]);
      text.append('tspan')
        .attr('x', 0)
        .attr('dy', 15)
        .text(words[1]);
    });

  // Create a y-scale without ticks. We want to mix graphs with very different counts.
  yAxis.append('g').call(d3.axisLeft(y).ticks(0));

  // Axes update function.
  const updateAxesDomains = extent => {
    y.domain(extent);
  };

  const dateBisect = d3.bisector(d => d.ts).right;

  // line path update function.
  const updateLinePath = (ts, shouldInterpolate) => {
    // Find the indexes of the current timestamp in the data series.
    const indexes = series.map(s => dateBisect(s.data, ts));

    let tPaths = paths;
    let tG = lineEnds;

    // If the line should be interpolated, use a transition.
    if (shouldInterpolate) {
      tPaths = paths.transition().duration(500);
      tG = lineEnds.transition().duration(500);
    }

    tPaths.attr('d', (d, i) => {
      const data = series[i].data;
      let idx = indexes[i];

      // When interpolating between lines, use the previous index to avoid
      // interpolating to a line that's one datapoint ahead of the current line.
      if (idx > 0 && shouldInterpolate) idx--;

      const dataSlice = data.slice(0, idx);
      return line(dataSlice);
    });

    tG.attr('transform', (d, i) => {
      const data = series[i].data;
      let dx = x(ts);

      // If we're at the end of the array, update the index to the last data point and also only use
      // the timestamp from that datapoint.
      let idx = indexes[i];
      if (idx >= data.length) {
        idx = data.length - 1;
        dx = x(data[idx].ts);
      }

      const dy = y(data[idx].rc);
      return `translate(${dx}, ${dy})`;
    });

    lineEnds.each(function(d, i) {
      const lineEnd = d3.select(this);
      const data = series[i].data;
      let idx = indexes[i];
      if (idx >= data.length) idx = data.length - 1;

      const text = lineEnd.select('text').text(txt);
      const rect = lineEnd.select('rect');
      const circle = lineEnd.select('circle');

      // Update visibility of elements if we're at the second datapoint or higher.
      if (idx > 0) {
        circle.attr('r', 6);
        rect.attr('stroke-opacity', 1);
        text.attr('fill-opacity', 1);
      }

      const txt = data[idx].rc.toLocaleString();
      text.text(txt);
    });
  };

  // Update the y scale with the first extent.
  updateAxesDomains(extents[0]);

  let currentExtentIndex = 0;
  const updateChart = (index, ts) => {
    // Find the current extent that the data is within.
    const extentIndex = series[0].data[index].rc > extents[0][1] ? 1 : 0;
    let extentChanged;
    if (currentExtentIndex !== extentIndex) {
      currentExtentIndex = extentIndex;
      extentChanged = true;
    }

    // If we're still in the same extent, only update the line path.
    // Otherwise update the axes and line path with transitions.
    if (!extentChanged) {
      updateLinePath(ts, false);
    } else {
      // Make sure the player waits for the transition.
      player.sleep(500);
      updateAxesDomains(extents[currentExtentIndex]);
      updateLinePath(ts, true);
    }
  };

  const svgRight = lineSvg.node().getBoundingClientRect().right;

  // On each time update, re-calc and re-draw all the things.
  player.on('time.update', (_, index, time) => {
    updateChart(index, time);


    // Rescale the svg if necessary
    let rightDiff = 0;
    rects.each(function() {
      const rect = d3.select(this);
      const diff = rect.node().getBoundingClientRect().right - svgRight;
      if (diff > rightDiff) rightDiff = diff;
    });

    if (rightDiff > 0) {
      lineSvg.attr('width', lineWidth + margin.left + margin.right + rightDiff);
    }
  });

  player.on('time.rewind', () => {
    lineEnds.each(function() {
      const lineEnd = d3.select(this);
      lineEnd.select('circle').attr('r', 0);
      lineEnd.select('rect').attr('stroke-opacity', 0);
      lineEnd.select('text').attr('fill-opacity', 0);
    });
  })
};

const prepareStatus = data => {
  const dateFormatter = d3.timeFormat('%Y-%m-%d');
  const monthFormatter = d3.timeFormat('%B %Y');

  const x = d3.scaleTime()
    .rangeRound([0, statusWidth])
    .domain(d3.extent(player.timestamps));

  // This is a tiny bit of cheating because we know what order in which the events appear :-)
  const colors = [
    vars.$green,
    vars.$lightblue,
    vars.$lightnavy,
    vars.$orange,
    vars.$red
  ];

  // Map the event data for faster lookups.
  data.forEach((ev, i) => {
    ev.color = colors[i];
  });
  const events = d3.map(data, d => dateFormatter(d.ts));

  // Create the actual line to draw
  const line = statusG.append('line').classed('timeline', true);

  const rocketG = statusG.append('g').classed('rocket-container', true);
  rocketG.append('use')
    .classed('rocket', true)
    .attr('fill', vars.$navy)
    .attr('width', 50)
    .attr('height', 50)
    .attr('transform', 'translate(0, -25)')
    .attr('xlink:href', '/images/icons/icons.svg#rocket')

  const monthX = 20;
  const monthText = rocketG.append('text')
    .attr('fill', vars.$navy)
    .attr('x', monthX)
    .attr('y', -24)
    .attr('text-anchor', 'middle');

  const drawEvent = ev => {
    const xPos = x(ev.ts);

    const lineTrans = 600;
    const fillTrans = 300;

    const evG = statusG.append('g')
      .classed('status-event', true)
      .attr('transform', `translate(${xPos},0)`);
    const line = evG.append('line')
      .style('stroke', ev.color)
      .attr('y1', 10)
      .attr('y2', 10)

    const use = evG.append('use')
      .attr('width', 30)
      .attr('height', 30)
      .attr('x', -15)
      .attr('y', 33)
      .attr('opacity', 0)
      .attr('fill', ev.color)
      .attr('xlink:href', '/images/icons/icons.svg#star')

    const text = evG.append('text')
      .attr('fill', ev.color)
      .attr('fill-opacity', 0)
      .attr('text-anchor', 'middle')
      .attr('y', 75)
      .text(ev.name)

    let endLine = 30;
    const bbox = text.node().getBoundingClientRect();
    statusG.selectAll('.status-event text').each(function(d, i) {
      const otherText = d3.select(this);
      if (otherText.node() === text.node()) return;

      if (bbox.left < otherText.node().getBoundingClientRect().right &&
          otherText.attr('y') !== '58') {
        endLine = 18;
        use.attr('y', 18);
        text.attr('y', 58);
      }
    });

    use
      .transition()
      .delay(lineTrans)
      .duration(fillTrans)
      .attr('opacity', 1);

    text.transition()
      .delay(lineTrans)
      .duration(fillTrans)
      .attr('fill-opacity', 1);

    line.transition()
      .duration(lineTrans)
      .attr('y2', endLine);
  };

  player.on('time.update', (e, i, time) => {
    line.attr('x2', x(time));
    rocketG.attr('transform', `translate(${x(time)},0)`);
    monthText.text(monthFormatter(time))
    const ev = events.get(dateFormatter(time));
    if (ev) drawEvent(ev);
  });

  player.on('time.rewind', () => {
    statusG.selectAll('.status-event').remove();
    rocketG.attr('transform', '');
  });
};

const prepareLabels = allData => {
  const dateFormatter = d3.timeFormat('%Y-%m-%d');
  const receipts = d3.map(allData.receipts, d => dateFormatter(d.ts));
  const followups = d3.map(allData.followups, d => dateFormatter(d.ts));
  const abandonedCarts = d3.map(allData.abandonedcarts, d => dateFormatter(d.ts));
  const widgets = d3.map(allData.widgetClicks, d => dateFormatter(d.ts));
  const conversions = d3.map(allData.conversions, d => dateFormatter(d.ts))

  const $rclicks = $('#receipt-clicks');
  const $fclicks = $('#followup-clicks');
  const $aclicks = $('#abandoned-clicks');
  const $recclicks = $('#rec-clicks');
  const $sclicks = $('#search-clicks');
  const $revenue = $('#revenue');

  player.on('time.update', (e, i, time) => {
    const ts = dateFormatter(time);
    const receipt = receipts.get(ts);
    if (receipt) $rclicks.text(receipt.rcl.toLocaleString());

    const followup = followups.get(ts);
    if (followup) $fclicks.text(followup.rcl.toLocaleString());

    const abandoned = abandonedCarts.get(ts);
    if (abandoned) $aclicks.text(abandoned.rcl.toLocaleString());

    const widget = widgets.get(ts);
    if (widget) {
      $recclicks.text(widget.rr.toLocaleString());
      $sclicks.text(widget.rs.toLocaleString());
    }

    const conversion = conversions.get(ts);
    if (conversion) {
      $revenue
        .text(formatCurrency(conversion.rr))
        .lettering()
        .find('span')
        .each((e, elem) => {
          if ($(elem).text() === ',') $(elem).addClass('comma');
        });
    }
  });

  player.on('time.rewind', () => {
    $revenue.html('&dollar;0');
    $('.clicks span').text('0');
  })
};

const preparePie = allData => {
  const dateFormatter = d3.timeFormat('%Y-%m-%d');
  const receipts = d3.map(allData.receipts, d => dateFormatter(d.ts));
  const followups = d3.map(allData.followups, d => dateFormatter(d.ts));
  const abandoneds = d3.map(allData.abandonedcarts, d => dateFormatter(d.ts));

  const receiptMax = d3.max(allData.receipts, d => d.rc);
  const followupMax = d3.max(allData.followups, d => d.rc);
  const abandonedMax = d3.max(allData.abandonedcarts, d => d.rc);
  const extent = [0, receiptMax + followupMax + abandonedMax];

  logger.debug('Extent of email counts', extent);

  const angleScale = d3.scaleLinear()
    .range([0, 2 * Math.PI])
    .domain(extent);

  const createData = () => {
    return {
      followup: 0,
      receipt: 0,
      abandoned: 0
    };
  };

  let currentData = createData();

  const chart = new PieChart('#donut-container svg', {
    center: { showLabel: false },
    color: {
      scheme: [vars.$green, vars.$lightnavy, vars.$orange],
      labels: true,
      lines: true
    }
  });

  player.on('time.update', (e, i, time) => {
    // Find the updated running cnt. If none is found for the current time, it will use the previous
    // value.
    const followup = followups.get(dateFormatter(time));
    if (followup) currentData.followup = followup.rc;
    const receipt = receipts.get(dateFormatter(time));
    if (receipt) currentData.receipt = receipt.rc;
    const abandoned = abandoneds.get(dateFormatter(time));
    if (abandoned) currentData.abandoned = abandoned.rc;

    const data = [
      { label: 'Receipts', value: currentData.receipt },
      { label: 'Follow-ups', value: currentData.followup },
      { label: 'Abandoned Carts', value: currentData.abandoned }
    ];

    const angle = angleScale(d3.sum(data, d => d.value));
    chart.pie.endAngle(angle);
    chart.update(data);
  });

  player.on('time.rewind', () => {
    currentData = createData();
    chart.reset();
  })
};

/**
 * Prepares the data for usage in the visualization.
 * @param {Object} data - The anniversary data :-)
 * @returns {Object} the updated data.
 */
const prepareData = data => {
  logger.debug('Preparing data');
  const timeParser = d3.timeParse('%Y-%m-%d');

  // Prepare all the date timestamps.
  for (const key in data) {
    if (!Array.isArray(data[key])) continue;
    data[key].forEach(d => {
      if (d.ts) d.ts = timeParser(d.ts);
    });
  }

  return data;
};

const prepareMap = allData => {
  const countrySum = {};

  // Mapping looks like this:
  // { ts: { countryCode: { c: 123}}}
  // We need to find maximum rc (running count) for the country so we can get its color.
  d3.values(allData.countryClicks)
    .forEach(countryMapping => {
      d3.entries(countryMapping)
        .forEach(entry => {
          // Entry has country code key and count values.
          if (!countrySum[entry.key]) countrySum[entry.key] = 0;
          countrySum[entry.key] += entry.value.c;
        });
    });

  // Each country gets it's own color scale
  const colors = d3.map();
  const interpolator = d3.interpolateRgb(mapGradient[0], mapGradient[1]);
  d3.entries(countrySum)
    .forEach(entry => {
      const colorScale = d3.scaleSequential()
        .domain([0, entry.value])
        .interpolator(interpolator);
      colors.set(entry.key, colorScale);
    });

  // Use the world-map helper to draw the map, but don't use it for updating the data.
  const worldMap = new WorldMap('#map-container svg', {
    fromColor: mapGradient[0],
    toColor: mapGradient[1],
    value: d => d.rc,
    valueLabel: d => (d.rc || 0).toLocaleString()
  });

  const dateFormatter = d3.timeFormat('%Y-%m-%d');
  player.on('time.update', (e, i, time) => {
    const countries = allData.countryClicks[dateFormatter(time)];
    if (!countries) return;
    for (const countryCode of d3.keys(countries)) {
      const countryG = worldMap.map.select(`g#country-${countryCode}`)
      countryG.select('path')
        .attr('fill', d => colors.get(countryCode)(d.rc = countries[countryCode].rc))

      // Only allow 3 stars per country for performance. 1 for small screens.
      const compareTo = small ? 1 : 3;
      if (countryG.selectAll('use').nodes().length >= compareTo) {
        continue;
      }

      const size = small ? 5 : 10;
      countryG.append('use')
        .attr('width', size)
        .attr('height', size)
        .attr('x', d => {
          const centroid = d.centroidP || d.centroid;
          if (!centroid) return 0;
          return centroid[0] + Math.random() * size - size;
        })
        .attr('y', d => {
          const centroid = d.centroidP || d.centroid;
          if (!centroid) return 0;
          return centroid[1] + Math.random() * size - size;
        })
        .attr('fill', vars.$green)
        .attr('opacity', 1)
        .attr('xlink:href', '#star')
        .transition()
        .duration(Math.random() * 500)
        .attr('opacity', 0)
        .remove();
    }
  });

  player.on('time.rewind', () => {
    worldMap.map.selectAll('g.country path').attr('fill', fromColor);
  })
};

const start = () => {
  const url = window.DATA_BASE_URL + '/anniversary.json';
  const $loader = $('#loader');
  const $prog = $('#progress');
  const xhr = d3.json(url)
    .on('progress', e => {
      if (e && e.lengthComputable) {
        const prog = Math.round(e.loaded / e.total * 100);
        $prog.text(`${prog}%`);
      }
    })
    .on('error', e => {
      logger.error(e);
    })
    .on('load', data => {
      $loader.hide();
      $('.container').show();
      resize();
      logger.debug('Data fetched', ...Object.keys(data).map(k => `${k}: ${data[k].length}`));
      data = prepareData(data);
      player = new Player(data.receipts, '#time-controls');
      prepareLineGraph(data);
      prepareStatus(data.events);
      prepareLabels(data);
      preparePie(data);
      prepareMap(data);
    })
    .get();
};

$(document).ready(() => {
  start();
  if (parent) parent.postMessage({ height: $(document).height() }, '*');
});
