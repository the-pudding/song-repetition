import * as d3 from 'd3';
import ScrollMagic from 'scrollmagic';
import { legendColor } from 'd3-svg-legend';

import DATA from './years.js';
import * as c from './constants.js';
import * as comm from './common.js';
import scroll_controller from './scroll.js';
import { BaseChart } from './basechart.js';
import { isMobile } from './helpers.js';

// If you change these, make sure to also change vars in overtime.styl
const linecolor = "steelblue";
const hitcolor = 'orange';
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
      let kwargs;
      if (isMobile()) {
        let h = d3.select(sel).node().offsetHeight;
        kwargs = {triggerHook: 'onEnter',
          duration: window.innerHeight/2,
        };
      } else {
        kwargs = {triggerHook: 'onCenter'};
      }
      kwargs.triggerElement = sel;
      let scene = new ScrollMagic.Scene(kwargs);

      scene.on('enter', () => {
        this.chart.step(n);
        d3.select(sel).classed('active', true);
      })
      .on('leave', () => {
        if (!kwargs.duration) {
          this.chart.step(Math.max(0, n-1));
        }
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

class OverTimeChart extends BaseChart {

  constructor() {
    let kwargs = {
      margin: {left: 40, top: 100, bottom: 20, right: 15},
      // TODO: maybe should enforce some constraints on aspect ratio?
      // that's the basic idea behind the mobile case
      hfrac: isMobile() ? .6 : .9,
    };
    super('#rovertime', kwargs);
    this.R = 4; // radius of year dots

    this._svg
      .append('text')
      .classed('title', true)
      .text("Repetition of Popular Music, by Year")
      .attr("transform","translate("+0+","+kwargs.margin.top/3+")")
      ;

    this.xscale = d3.scaleLinear()
      .domain(d3.extent(DATA, (yr) => (yr.year)))
      .range([0, this.W]);

    let yrange = INVERT_Y ? [0, this.H] : [this.H, 0];
    this.yextent = {pct: [40, 60]};
    this.yextent.rscore = this.yextent.pct.map(comm.pct_to_rscore);
    this.yscale = d3.scaleLinear()
      .domain(this.yextent.rscore)
      .range(yrange);

    // helper functions mapping from data points to x/y coords
    this.datx = yr => (this.xscale(yr.year));
    this.daty = yr => (this.yscale(yr.rscore));

    this.setupAxes();
    // set up the data path for all songs (no top 10 yet)
    this.setupOverall();
  }

  setLegend(enabled) {
    let legend = this._svg.select('.legend');
    if (legend.empty()) {
      legend = this.setupLegend();
    }
    legend
      .transition()
      .duration(400)
      .attr('opacity', enabled ? 1 : 0);
  }
  setupLegend() {
    let legendel = this._svg.append('g')
      .attr('opacity', 0)
      .classed('legend', true);
    let scale = d3.scaleOrdinal()
      .domain(['All Songs', 'Top 10'])
      .range([linecolor, hitcolor]);
    let legend = legendColor()
      .shape('rect')
      .shapeWidth(25)
      .shapeHeight(3)
      .shapePadding(40)
      .orient('horizontal')
      .scale(scale);
    legendel.call(legend);
    let bb = legendel.node().getBBox();
    let x = this.totalW - bb.width - 10;
    let y = 10;
    legendel
      .attr('transform', `translate(${x}, ${y})`)
    return legendel;
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
    // Render the legend iff we're showing both lines.
    this.setLegend(this.show_hits);
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
        .classed('trendline hitpath', true)
        .attr('stroke', hitcolor)
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

  setupAxes() {
    // X axis
    let n_xticks = 5;
    this.svg.append("g")
        .classed('xaxis', true)
        .attr("transform", "translate(0 " + this.H + ")")
        .call(d3.axisBottom(this.xscale).ticks(n_xticks, 'd'));

    // Y axis
    let yticks = {
      major: d3.range(this.yextent.pct[0], this.yextent.pct[1]+1, 5),
      minor: d3.range(this.yextent.pct[0], this.yextent.pct[1]+1, 1),
    }
    this.svg.append("g")
        .classed('yaxis', true)
        .call(
            d3.axisLeft(this.yscale)
            .tickValues(yticks.major.map(comm.pct_to_rscore))
            .tickFormat(comm.rscore_to_readable)
        )
        .append("text")
          .attr("transform", "rotate(-90)")
          .text("repetitiveness");
    // TODO: figure out why label isn't showing up

    // Major and minor gridlines. NB: it's important to draw the minor grids
    // before the major, so that when they coincide, the major gridlines have
    // a higher z-index.

    // X-gridlines
    let xgrid = d3.axisBottom(this.xscale).ticks(n_xticks);
    let xgridminor = d3.axisBottom(this.xscale).ticks(45);
    this.svg.append("g")
      .attr("class", "grid grid-minor grid-x")
      .attr("transform", "translate(0," + this.H + ")")
      .call(xgridminor
          .tickSize(-this.H)
          .tickFormat("")
      )
      .call(this._customGrid)
    this.svg.append("g")
      .attr("class", "grid grid-major grid-x")
      .attr("transform", "translate(0," + this.H + ")")
      .call(xgrid
          .tickSize(-this.H)
          .tickFormat("")
      )
      .call(this._customGrid)
    // Y-gridlines (major and minor)

    this.svg.append("g")
      .attr("class", "grid grid-minor grid-y")
      .call(d3.axisLeft(this.yscale)
          .tickValues(yticks.minor.map(comm.pct_to_rscore))
          .tickSize(-this.W)
          .tickFormat("")
      )
      .call(this._customGrid)
    this.svg.append("g")
      .attr("class", "grid grid-major grid-y")
      .call(d3.axisLeft(this.yscale)
          .tickValues(yticks.major.map(comm.pct_to_rscore))
          .tickSize(-this.W)
          .tickFormat("")
      )
      .call(this._customGrid)
  }

  _customGrid(g) {
    // It stinks that I have to do this.
    g.select('.domain').remove();
    g.selectAll('line').attr('stroke', null);
  }

  setupOverall() {
    // line
    this.line = d3.line()
      .x(this.datx)
      .y(this.daty);
    // render it
    this.path = this.svg.append("path")
      .classed('trendline', true)
      .attr("stroke", linecolor)
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
