import * as d3 from 'd3';
import DATA from './years.js';
import ScrollMagic from 'scrollmagic';

var linecolor = "steelblue";
// Whether to dynamically adjust the yaxis bounds when hovering over a year,
// to accomodate topsongs. Doesn't work very well.
const MOVING_YAXIS = false;
// Don't include topsongs when calculating ybounds.
const SMALL_YAXIS = 1;

// Which year to stop at for each transition stage
const TRANSITION_YEARS = [0, 1960, 1980, 2014, 2015];
const NSTAGES = TRANSITION_YEARS.length;
const FIRST_YEAR = 1960;
const LAST_YEAR = 2015;

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
    for (let n=0; n <= NSTAGES-1; n++) {
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
    this.R = 25; // radius of artist circles
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
    this.yscale = d3.scaleLinear()
      .domain(d3.extent(all_ys))
      .range([this.H, 0]);
    
    // helper functions mapping from data points to x/y coords
    this.datx = (yr) => (this.xscale(yr.year));
    this.daty = (yr) => (this.yscale(yr.rscore));

    // X axis
    this.svg.append("g")
        .attr("transform", "translate(0 " + this.H + ")")
        .call(d3.axisBottom(this.xscale).ticks(10, 'd'));

    // Y axis
    this.svg.append("g")
        .classed('yaxis', true)
          .call(d3.axisLeft(this.yscale))
        .append("text")
          .attr("transform", "rotate(-90)")
          .text("repetitiveness");
    // TODO: figure out why label isn't showing up

    this.addGridLines();
    // set up the data path for all songs (no top 10 yet)
    this.setupOverall();
  }
  
  step(stage) {
    console.assert(0 <= stage && stage < NSTAGES);
    // All years after this will be hidden
    this.maxyear = TRANSITION_YEARS[stage];
    this.redrawData();
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
    let pts = this.svg.selectAll('.pt').data(currData);
    let newpts = pts.enter()
      .append('circle')
      .classed('pt', true)
      .attr('r', 3)
      .attr('cx', this.datx)
      .attr('cy', this.daty)
      .on('mouseover', (d,i,n) => {this.focusYear(d,i,n)})
      .on('mouseout', (d,i,n) => {this.defocusYear(d,i,n)})
      .attr('fill', linecolor);
    let animation_duration = 2000;
    // Remove extra points (happens when scrolling up)
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
      .attr('opacity', 1);

    // update extent of path/line
    var totalLength = this.path.node().getTotalLength();
    var lenscale = d3.scaleLinear()
      .domain([FIRST_YEAR, LAST_YEAR])
      .range([totalLength, 0]);
    var newLength = Math.min(totalLength, lenscale(this.maxyear));
    this.path.transition()
      .delay(headstart)
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
      .attr("class", "grid")
      .attr('stroke-width', gridwidth)
      .attr("transform", "translate(0," + this.H + ")")
      .call(xgrid
          .tickSize(-this.H)
          .tickFormat("")
      );
    this.svg.append("g")
      .attr("class", "grid")
      .attr('stroke-width', gridwidth)
      .call(ygrid
          .tickSize(-this.W)
          .tickFormat("")
      );
  }

  setupOverall() {
    // line
    var line = d3.line()
      .x( (yr) => (this.xscale(yr.year)))
      .y( (yr) => (this.yscale(yr.rscore)));
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
