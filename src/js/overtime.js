import * as d3 from 'd3';
import DATA from './years.js';
import ScrollMagic from 'scrollmagic';
import * as c from './constants.js';
import * as comm from './common.js';

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
    // TODO: controller per scene, or one global controller?
    this.controller = new ScrollMagic.Controller();
    let rootsel = '#overtime-graphic';
    this.root = d3.select(rootsel);
    this.vis = this.root.select('.graphic-vis');
    this.prose = this.root.select('.graphic-prose');

    var viewportHeight = window.innerHeight;
    var enterExitScene = new ScrollMagic.Scene({
      triggerElement: rootsel,
      triggerHook: '0', // TODO: meaning?
      duration: Math.max(1, this.root.node().offsetHeight - viewportHeight),
    });
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
        console.log('Entered stage' + n);
        this.chart.step(n);
        d3.select(sel).classed('active', true);
      })
      .on('leave', () => {
        console.log('Left stage' + n);
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
    this.R = 3; // radius of year dots
    this.svg = this.root.append('svg')
      .attr('width', totalW)
      .attr('height', totalH)
      .style('background-color', 'rgba(255,240,255,1)')
      .append("g")
        .attr("transform", "translate(" + margin.left + " " + margin.top + ")");

    //this.xscale = d3.scaleOrdinal()
    this.xscale = d3.scaleLinear() // TODO: figure out ordinal v linear
      .domain(d3.extent(DATA, (yr) => (yr.year)))
      .range([0, this.W]);
    // Scale the y axis up enough to accomodate the top topsong
    // (TODO: might want to do this dynamically)
    let topsongs = DATA.map((yr) => (yr.topsong.rscore));
    let yrscores = DATA.map((yr) => (yr.rscore));
    let hitscores = DATA.map((yr) => (yr.hitsRscore));
    let all_ys = yrscores.concat(hitscores);
    if (!MOVING_YAXIS && !SMALL_YAXIS) {
      all_ys = all_ys.concat(topsongs);
    }
    all_ys.push(0.75); 
    let yextent = d3.extent(all_ys);
    this.ymin = yextent[0];
    this.ymax = yextent[1];
    if (c.runits === 'pct') {
      all_ys = all_ys.map(comm.rscore_to_pct);
    }
    let yrange = INVERT_Y ? [0, this.H] : [this.H, 0];
    this.yscale = d3.scaleLinear()
      .domain(d3.extent(all_ys))
      .range(yrange);
    
    // helper functions mapping from data points to x/y coords
    this.datx = (yr) => (this.xscale(yr.year));
    if (c.runits === 'pct') {
      this.daty = yr => this.yscale(comm.rscore_to_pct(yr.rscore));
    } else {
      this.daty = (yr) => (this.yscale(yr.rscore));
    }

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
            .tickFormat(c.runits === 'pct' && d3.format('.0%'))
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
    this.redrawData();
    this.drawHits();
    // TODO: highlight 'focal' year. May also want to show topsongs
    // for 1980 and 2014.
    // TODO: top 10 line

  }

  /** Called when this.maxyear changes. Show/hide the appropriate points and
   * parts of the line, using d3 transitions. */
  redrawData() {
    // TODO: cannot figure out why dots trail the line animation
    // from 1980 to 2014 despite headstart :/
    let currData = DATA.filter((y) => (y.year <= this.maxyear));
    console.log('Redrawing with ' + currData.length + ' data points.');
    let opacityFn = y => {
      if (!this.focalyear) return 1;
      return y.year === this.focalyear ? 1 : .5;
    }
    let pts = this.svg.selectAll('.allpt').data(currData);
    let newpts = pts.enter().append('circle');
    newpts.merge(pts)
      .classed('pt allpt', true)
      .attr('r', y => (y.year === this.focalyear ? this.R*1.8 : this.R))
      .attr('cx', this.datx)
      .attr('cy', this.daty)
      .on('mouseover', (d,i,n) => {this.focusYear(d,i,n)})
      .on('mouseout', (d,i,n) => {this.defocusYear(d,i,n)})
      .attr('opacity', opacityFn)
      .attr('fill', y => (y.year === this.focalyear ? 'rgb(0, 111, 200)' : linecolor));
    // TODO: this should probably be a function of the number of nodes being 
    // added/removed, so that it happens at a consistent speed.
    let animation_duration = 2000;
    // Remove extra points (happens when scrolling up)
    // TODO: race condition-y bug with fast scrolling back and forth. When entering
    // a stage, points that are on their way out from having left earlier might be
    // caught in the selection. Then they get removed, and we don't have the right
    // number of points.
    // Maybe the solution is to do something similar to how the path is handled. 
    // Draw the whole thing at the beginning and never remove it, just selectively
    // mask and unmask it.
    pts.exit()
      .transition()
      .duration(animation_duration)
      .attr('opacity', 0)
      .remove();
    // Start point animation this much before line animation
    let headstart = 200;
    // How long to fade in an individual point
    let pointAnimationDuration = 200;
    let delay_scale = (d,i) => {
      if (newpts.size() === 1) {
        return animation_duration - pointAnimationDuration;
      }
      let scale = d3.scaleLinear().domain([0, newpts.size()-1])
        .range([0, animation_duration-pointAnimationDuration])
      return scale(i);
    }
    newpts.attr('opacity', 0)
      .transition()
      .delay(delay_scale)
      .duration(pointAnimationDuration)
      .attr('opacity', opacityFn);

    // update extent of path/line
    // TODO: why does the line stop just short of 1980 in stage 1?
    var totalLength = this.path.node().getTotalLength();
    var lenscale = d3.scaleLinear()
      .clamp(true)
      .domain(c.year_extent)
      .range([totalLength, 0]);
    var newLength = lenscale(this.maxyear);
    this.path.transition()
      .delay(headstart)
      .duration(animation_duration)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', newLength);
  }

  drawHits() {
    let dat = this.show_hits ? DATA : [];
    console.log(`show_hits = ${this.show_hits}, dat.length = ${dat.length}`);
    let pts = this.svg.selectAll('.hitpt').data(dat);
    let animation_duration = 2000;
    let hity = yr => {
      if (c.runits === 'pct') {
        return this.yscale(comm.rscore_to_pct(yr.hitsRscore));
      } else {
        return this.yscale(yr.hitsRscore);
      }
    }
    pts.exit().transition()
      .duration(animation_duration)
      .attr('opacity', 0)
      .remove();
    let newpts = pts.enter().append('circle');
    newpts.merge(pts)
      .classed('pt hitpt', true)
      .attr('r', this.R)
      .attr('cy', hity)
      .attr('cx', this.datx)
      .attr('fill', 'orange');
    // How long to fade in an individual point
    let pointAnimationDuration = 200;
    let delay_scale = (d,i) => {
      if (newpts.size() === 1) {
        return animation_duration - pointAnimationDuration;
      }
      let scale = d3.scaleLinear().domain([0, newpts.size()-1])
        .range([0, animation_duration-pointAnimationDuration])
      return scale(i);
    }
    newpts.attr('opacity', 0)
      .transition()
      .delay(delay_scale)
      .duration(pointAnimationDuration)
      .attr('opacity', 1);
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
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', newLength);
  }

  updateYMax(ymax) {
    if (!ymax) {
      this.ymax = this.prevYMax;
      this.prevYMax = null;
    } else {
      this.prevYMax = this.ymax;
      this.ymax = ymax;
    }
    this.yscale.domain([this.ymin, this.ymax]);
    this.svg.select('.yaxis').call(d3.axisLeft(this.yscale));
    // need to redraw all points
    //this.plotOverall()
    // TODO: this turns out to be kinda complicated. probably should try
    // to smoothly animate the line down (or up), but this has the effect
    // of pulling the rug from under the user's cursor, causing the point
    // they were on to be mouseout'd. Blargh.
  }

  addGridLines() {
    let xgrid = d3.axisBottom(this.xscale).ticks(8);
    let ygrid = d3.axisLeft(this.yscale).ticks(8);
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
    var line = d3.line()
      .x(this.datx)
      .y(this.daty);
    // render it
    this.path = this.svg.append("path")
      .datum(DATA)
      .attr("stroke", linecolor)
      .attr("stroke-width", 1.5)
      .attr("fill", "none")
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("d", line);
    
    // Hide the line by default (using some svg magic I don't totally understand)
    var totalLength = this.path.node().getTotalLength();
    this.path
      .attr('stroke-dasharray', totalLength + ' ' +totalLength)
      .attr('stroke-dashoffset', totalLength);
  }

  focusYear(dat, i, nodes) {
    let pt = nodes[i];
    d3.select(pt).attr('fill', 'red');
    // add a point and label for topsong
    let hov = this.svg.append('g').classed('hover', true);
    let topsong = dat.topsong;
    topsong.year = dat.year;
    let x = this.xscale(topsong.year);
    if (MOVING_YAXIS && topsong.rscore > this.ymax) {
      console.log('increasing ymax');
      this.updateYMax(topsong.rscore);
    }
    let y = this.yscale(topsong.rscore);
    hov.append('circle')
      .classed('pt', true)
      .attr('r', 3)
      .attr('cx', x)
      .attr('cy', y)
      .attr('fill', 'fuchsia');

    hov.append('text')
      .text(topsong.artist + ' - ' + topsong.title)
      .attr('x', x+11)
      .attr('y', y+3)
      .attr('font-size', 16);

  }

  defocusYear(dat, i, nodes) {
    if (this.prevYMax) {
      this.updateYMax();
    }
    let pt = nodes[i];
    d3.select(pt).attr('fill', linecolor);
    this.svg.selectAll('.hover').remove();
  }

  static init() {
    let c = new OverTimeChart();
    return c;
  }
}

export default OverTimeGraphic;
