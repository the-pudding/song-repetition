import * as d3 from 'd3';
import DATA from './years.js';
import * as c from './constants.js';
import * as comm from './common.js';
import scroll_controller from './scroll.js';
import ScrollMagic from 'scrollmagic';

var linecolor = "steelblue";
// Whether to dynamically adjust the yaxis bounds when hovering over a year,
// to accomodate topsongs. Doesn't work very well.
const MOVING_YAXIS = false;
// Don't include topsongs when calculating ybounds.
const SMALL_YAXIS = 1;
const INVERT_Y = 0;

// scrollmagic transitions
const STAGES = [
  {maxyear:0}, {maxyear:1960, focus:1960}, {maxyear:1980, focus:1980},
  {maxyear:2014, focus:2014}, {maxyear:2015},
  {maxyear: 2015, hits:true}
]

/** Coordinates the OverTime chart and the associated bits of prose, and hitches
 * them to ScrollMagic.
 * ScrollMagic structure and code snippets taken from:
 * - https://pudding.cool/process/how-to-implement-scrollytelling/
 * - https://github.com/polygraph-cool/how-to-implement-scrollytelling
 */
class OverTimeGraphic {
  constructor(chart) {
    this.chart = chart;
    this.controller = scroll_controller;
    let rootsel = '#overtime-graphic';
    this.root = d3.select(rootsel);
    this.vis = this.root.select('.graphic-vis');
    this.prose = this.root.select('.graphic-prose');

    var viewportHeight = window.innerHeight;
    var enterExitScene = new ScrollMagic.Scene({
      triggerElement: rootsel,
      triggerHook: 'onLeave',
      duration: Math.max(1, this.root.node().offsetHeight - viewportHeight),
    });
    // TODO: is there maybe an easier way to do this with scrollmagic's API?
    // look into emulating this example?
    // http://scrollmagic.io/examples/basic/simple_pinning.html
    enterExitScene
      .on('enter', () => {
        this.toggleFixed(true, false);
      })
      .on('leave', (e) => {
        this.toggleFixed(false, e.scrollDirection === 'FORWARD');
      });
    enterExitScene.addTo(this.controller);

    this.setupIntermediateScenes();
  }

  toggleFixed(fixed, bottom) {
    this.vis.classed('is-fixed', fixed);
    this.vis.classed('is-bottom', bottom);
  }

  setupIntermediateScenes() {
    for (let n=0; n <= STAGES.length-1; n++) {
      let sel = '.stage' + n;
      let scene = new ScrollMagic.Scene({
        triggerElement: sel,
        triggerHook: 'onCenter',
      });

      scene.on('enter', () => {
        this.chart.step(n);
        d3.select(sel).classed('active', true);
      })
      .on('leave', () => {
        this.chart.step(Math.max(0, n-1));
        d3.select(sel).classed('active', false);
      });

      scene.addTo(this.controller);
    }

  }

  static init() {
    let chart = new OverTimeChart();
    let graphic = new OverTimeGraphic(chart);
    return graphic;
  }
}

class OverTimeChart {

  constructor() {
    this.root = d3.select('#rovertime');
    let margin = {top: 20, right: 20, bottom: 50, left: 40};
    var totalW = 800;
    var totalH = 600;
    this.W = totalW - margin.left - margin.right;
    this.H = totalH - margin.top - margin.bottom;
    this.R = 4; // radius of year dots
    this.svg = this.root.append('svg')
      .attr('width', totalW)
      .attr('height', totalH)
      // .style('background-color', 'rgba(255,240,255,1)')
      .append("g")
        .attr("transform", "translate(" + margin.left + " " + margin.top + ")");

    //this.xscale = d3.scaleOrdinal()
    this.xscale = d3.scaleLinear() // TODO: figure out ordinal v linear
      .domain(d3.extent(DATA, (yr) => (yr.year)))
      .range([0, this.W]);
    let yrscores = DATA.map((yr) => (yr.rscore));
    let hitscores = DATA.map((yr) => (yr.hitsRscore));
    let all_ys = yrscores.concat(hitscores);
    all_ys.push(0.75); // ???
    let yextent = d3.extent(all_ys);
    this.ymin = yextent[0];
    this.ymax = yextent[1];
    let yrange = INVERT_Y ? [0, this.H] : [this.H, 0];
    let ticks_pct = d3.range(41, 61);
    let ticks = ticks_pct.map(comm.pct_to_rscore);
    this.yticks = ticks;
    this.yscale = d3.scaleLinear()
      .domain(d3.extent(ticks))
      .range(yrange);

    // helper functions mapping from data points to x/y coords
    this.datx = yr => (this.xscale(yr.year));
    this.daty = yr => (this.yscale(yr.rscore));

    // X axis
    this.svg.append("g")
        .classed('xaxis', true)
        .attr("transform", "translate(0 " + this.H + ")")
        .call(d3.axisBottom(this.xscale).ticks(10, 'd'));

    // Y axis
    this.svg.append("g")
        .classed('yaxis', true)
        .call(
            d3.axisLeft(this.yscale)
            .tickValues(ticks)
            .tickFormat(comm.rscore_to_readable)
            //.tickFormat(c.runits === 'pct' && d3.format('.0%'))
        )
        .append("text")
          .attr("transform", "rotate(-90)")
          .text("repetitiveness");
    // TODO: figure out why label isn't showing up

    this.addGridLines();
    // set up the data path for all songs (no top 10 yet)
    this.setupOverall();
  }

  step(stage_index) {
    console.assert(0 <= stage_index && stage_index < STAGES.length);
    let stage = STAGES[stage_index];
    // All years after this will be hidden
    this.maxyear = stage.maxyear;
    this.focalyear = stage.focus;
    this.show_hits = stage.hits;
    this.redrawData(stage);
    this.drawHits();
  }

  /** Called when this.maxyear changes. Show/hide the appropriate points and
   * parts of the line, using d3 transitions. */
  redrawData(stage) {
    let currData = DATA.filter((y) => (y.year <= this.maxyear));
    // Draw a point for focal year, if any
    let focalData = DATA.filter(y=> y.year === this.focalyear)
    let pt = this.svg.selectAll('.pt').data(focalData);
    pt.exit()
      .remove();
    let newpt = pt.enter()
      .append('circle')
      .classed('pt', true);
    pt = pt.merge(newpt)
    pt
      .attr('r', this.R)
      .attr('cx', this.datx)
      .attr('cy', this.daty)
      .attr('opacity', 0)
      .attr('fill', 'rgb(0, 111, 200)');

    let next_offset = this.path.node().getTotalLength()-stage.pathlength;
    let old_offset = this.path.attr('stroke-dashoffset');
    let delta = Math.abs(next_offset-old_offset);
    let animation_duration = 50 + 2.5*delta;

    this.path
      .transition()
      .duration(animation_duration)
      .attr('stroke-dashoffset', next_offset)
    pt.transition()
      .delay(animation_duration)
      .duration(200)
      .attr('opacity', 1);
  }

  drawHits() {
    let dat = this.show_hits ? DATA : [];
    let animation_duration = 2000;
    let hity = yr => this.yscale(yr.hitsRscore);
    let hitline = d3.line().y(hity).x(this.datx);
    let hitpath = this.svg.select('.hitpath');
    if (hitpath.empty()) {
      hitpath = this.svg.append('path')
        .datum(DATA)
        .classed('hitpath', true)
        .attr('stroke', 'orange')
        .attr('stroke-width', 1.5)
        .attr('fill', 'none')
        .attr('d', hitline);
      var totalLength = hitpath.node().getTotalLength();
      hitpath
        .attr('stroke-dasharray', totalLength + ' ' +totalLength)
        .attr('stroke-dashoffset', totalLength);
    }
    var totalLength = hitpath.node().getTotalLength();
    var lenscale = d3.scaleLinear()
      .clamp(true)
      .domain(c.year_extent)
      .range([totalLength, 0]);
    var newLength = lenscale(this.show_hits ? this.maxyear : c.minyear);
    hitpath.transition()
      .duration(animation_duration)
      .attr('stroke-dashoffset', newLength);
  }

  addGridLines() {
    let xgrid = d3.axisBottom(this.xscale).ticks(8);
    let ygrid = d3.axisLeft(this.yscale).tickValues(this.yticks);
    let gridwidth = .3;
    this.svg.append("g")
      .attr("class", "grid grid-x")
      .attr('stroke-width', gridwidth)
      .attr("transform", "translate(0," + this.H + ")")
      .call(xgrid
          .tickSize(-this.H)
          .tickFormat("")
      );
    this.svg.append("g")
      .attr("class", "grid grid-y")
      .attr('stroke-width', gridwidth)
      .call(ygrid
          .tickSize(-this.W)
          .tickFormat("")
      );
  }

  setupOverall() {
    // line
    this.line = d3.line()
      .x(this.datx)
      .y(this.daty);
    // render it
    this.path = this.svg.append("path")
      .attr("stroke", linecolor)
      .attr("stroke-width", 1.5)
      .attr("fill", "none")
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
    this.setupPathLengths();
    this.path.attr('d', this.line(DATA));
    var totalLength = this.path.node().getTotalLength();
    this.path
      .attr('stroke-dasharray', totalLength +' ' + totalLength)
      .attr('stroke-dashoffset', totalLength);
  }

  setupPathLengths() {
    for (let stage of STAGES) {
      let stagedat = DATA.filter(y=> y.year <= stage.maxyear);
      this.path.attr('d', this.line(stagedat));
      stage.pathlength = this.path.node().getTotalLength();
    }
  }

  static init() {
    let c = new OverTimeChart();
    return c;
  }
}

export default OverTimeGraphic;
