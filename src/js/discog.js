/** Widget for showing repetitiveness of an individual artist's discography
 */
import * as d3 from 'd3';
import scroll_controller from './scroll.js';
import ScrollMagic from 'scrollmagic';
import d3Tip from 'd3-tip';

import * as comm from './common.js';
import { BeeswarmChart } from './basechart.js';

import ARTIST_LOOKUP from './starmap.js';
import HIST from './histogram-data.js';

import $ from 'jquery';
import 'select2';

const DEBUG_DISPLACEMENT = false;

const DEFAULT_ARTIST = 'Gwen Stefani';

// If an artist has at least this many songs, grow the height to accomodate all the
// circles.
const BIG_DISCOGRAPHY = 40;
// How much to multiply the base height by when expanding to accomodate a big discography.
const GROWTH_FACTOR = 1.3;

// Default limits for the rscore axis
const RLIM = [comm.pctiles[10], comm.pctiles[90]];
//const RLIM = [comm.pctiles[1], comm.pctiles[99]];

function songToolTip(s) {
  return `<div class="d3-tip">
      <div>${s.title} (${Math.floor(s.yearf)})</div>
      <div style="text-align: center;">${comm.rscore_to_readable(s.rscore)} compressed</div>
      </div>`;
}

class DiscogWidget extends BeeswarmChart {

  // TODO: a general pattern worth trying: use setters to handle the rerendering
  // associated with certain state changes (setting beehive, setting artist, etc.)
  constructor() {
    let rootsel = '#discog-widget';
    super(rootsel);
    this.tip = d3Tip().html((d) => (songToolTip(d)));
    let insert = elem => this.root.insert(elem, ":first-child");

    let controls = insert("div");
    insert('h1');
    let head = this.setupHeader();
    head.append("button")
      .text("random")
      .on("click", ()=> {
        this.updateArtist();
        this.updateHeader();
      });
    this.originalHeight = this.totalH;
    this.svg.call(this.tip);
    // Whether we've grown this figure's height to accomodate a big discography.
    this.expanded = false;
    this.setupAxes();
    this.updateArtist(DEFAULT_ARTIST);
    this.bindLinks();
  }

  resizeHeight(h, duration=0) {
    super.resizeHeight(h, duration);
    this.yscale.range([this.H-this.R, this.R]);
    this._svg.select('.axis')
      .transition()
      .duration(duration)
      .attr('transform', `translate(0 ${this.H})`);
    let offset = 50;
    // This doesn't work as a transition. Just does nothing. I have nooooo idea why.
    this.svg.selectAll('.baseline')
      .select('line')
      .attr('y1', this.H-offset)
      .attr('y2', offset)

    this.updateHistogram();
  }

  // Add click callbacks to the link elements in the later prose which are supposed
  // to have the effect of jumping to a particular artist.
  bindLinks() {
    d3.select('#discog-examples').selectAll('a')
      .on('click', (d,i,n) => this.jumpToArtist(n[i].textContent));
  }

  jumpToArtist(artist) {
    this.updateArtist(artist);
    this.updateHeader();
    scroll_controller.scrollTo(this.rootsel);
  }

  get extent() {
    return RLIM;
  }
  getx(datum) { return datum.rscore; }

  // TODO: this is all kind of a mess right now. Need to structure it better
  // and make it more d3 idiomatic
  setupAxes() {
    let offset = 50;
    //let marker_pctiles = [10, 50, 90];
    let marker_pctiles = [50];
    let base = this.svg.selectAll(".baseline").data(marker_pctiles)
      .enter()
      .append("g")
      .classed("baseline", true);
    base.append("line")
      .attr("x1", (k)=>this.xscale(comm.pctiles[k]))
      .attr("y1", this.H-offset)
      .attr("x2", (k)=>this.xscale(comm.pctiles[k]))
      .attr("y2", offset)
      .attr("stroke", "black")
      .attr("stroke-width", 1);
    base.append("text")
      .attr("text-anchor", "middle")
      .attr("x", (k)=>this.xscale(comm.pctiles[k]))
      .attr("y", offset-5)
      .attr("font-size", 12)
      .text((k) => (k === 50 ? "median" : k+"%"));
  }

  updateAxes() {
    // TODO: I think this is redundant wrt parent class's updateAxis method?
    this._svg.select('.axis')
        .call(d3.axisBottom(this.xscale)
            .tickSizeOuter(0)
            .tickSizeInner(4)
            .tickPadding(6)
            .tickFormat(comm.rscore_to_readable)
            //.ticks(0)
            );

    this.svg.selectAll('.baseline').select('line')
      .transition()
      .duration(1000)
      .attr("x1", (k)=>this.xscale(comm.pctiles[k]))
      .attr("x2", (k)=>this.xscale(comm.pctiles[k]));
    this.svg.selectAll('.baseline').select('text')
      .transition()
      .duration(1000)
      .attr("x", (k)=>this.xscale(comm.pctiles[k]));

  }

  updateHistogram() {
    // map counts to height of bar
    let hdomain = [0, d3.max(HIST, h=>h.count)];
    let hscale = d3.scaleLinear()
      .domain(hdomain)
      .range([0, this.H*8/10]);
    let bars = this.svg.selectAll('.bar').data(HIST);
    bars.exit().remove();
    let newbars = bars.enter()
      .append('rect')
      .classed('bar', true);
    newbars.merge(bars)
      .attr('fill', h => comm.rscore_cmap((h.left+h.right)/2) )
      .attr('opacity', 0.2);
    newbars
      .attr("x", h=> this.xscale(h.left))
      // start at the midpoint, then move up half the height of the bar
      // (the goal is for the bars to be symmetric about the x-axis, which
      // is located at the midpoint of the y-axis)
      .attr("y", h=> this.H/2 - hscale(h.count)/2)
      .attr("width", h=> this.xscale(h.right)-this.xscale(h.left))
      .attr("height", h=> hscale(h.count));
    bars.transition()
      .duration(300)
      .attr("x", h=> this.xscale(h.left))
      .attr("y", h=> this.H/2 - hscale(h.count)/2)
      .attr("width", h=> this.xscale(h.right)-this.xscale(h.left))
      .attr("height", h=> hscale(h.count));
  }

  // Called to adjust circle positions when force simulation ticks
  nudge() {
    this.svg.selectAll(".song")
      .attr("transform", (d)=>("translate("+d.x+" "+d.y+")"));
  }

  setupHeader() {
    let hd = this.root.select('h1');
    hd.text('Artist Discography');
    let dd = hd.append('select').classed('discog-artist-dd', true);
    dd.selectAll('option').data(Object.keys(ARTIST_LOOKUP).sort())
      .enter()
      .append('option')
      .attr('value', a=>a)
      .attr('selected', a=> a===DEFAULT_ARTIST ? true : null)
      .text(a=>a);
    $('.discog-artist-dd').select2();
    $('.discog-artist-dd').on("select2:select", e=> {
      let artist = e.params.data.id;
      this.updateArtist(artist);
    });
    return hd;
  }

  // Called when the artist is changed by some means other than the dropdown
  // (i.e. the randomize button)
  updateHeader() {
    $('.discog-artist-dd').val(this.artist).trigger('change');
  }

  // Use the given artist's discog. (Or, if none given, choose a random artist.)
  updateArtist(artist) {
    if (!artist) {
      let tries = 4;
      let artists = Object.keys(ARTIST_LOOKUP);
      while (tries && (!artist || artist === this.artist)) {
        let i = Math.floor(Math.random()*artists.length);
        artist = artists[i];
        tries--;
      }
      if (tries === 0) {
        console.warn("Couldn't reroll a different artist. That's pretty weird.");
      }
    }
    this.artist = artist;
    let url = 'assets/discogs/' + ARTIST_LOOKUP[this.artist];
    d3.json(url, (discog) => {
      this.discog = discog;
      this.resizeIfNecessary(discog.length);
      this.renderSongs();
    });
  }

  resizeIfNecessary(nsongs) {
    let shouldExpand = nsongs >= BIG_DISCOGRAPHY;
    if (shouldExpand !== this.expanded) {
      //console.log(`Setting expand = ${shouldExpand} for discography with size ${nsongs}`);
      let h = this.originalHeight * (shouldExpand ? GROWTH_FACTOR : 1);
      this.resizeHeight(h, 500);
      this.expanded = shouldExpand;
    }
  }

  renderSongs() {
    let discog = this.discog;
    let xkey = (s) => (s.rscore);
    let rextent = d3.extent(discog, xkey);
    rextent[0] = Math.min(rextent[0], RLIM[0]);
    rextent[1] = Math.max(rextent[1], RLIM[1]);
    this.rextent = rextent;

    this.xscale = d3.scaleLinear()
      .domain(rextent)
      .range([this.R, this.W-this.R]);
    // TODO: enough reuse going on at this point to consider some kind of helper
    // base class/mixin. Lots of duplication with artists.js.
    this.xdat = (d) => (this.xscale(xkey(d)));
    this.updateAxes();
    this.updateHistogram();

    let iters = 100; // d3 default corresponds to 300
    let decay = 1 - Math.pow(0.001, 1/iters);
    this.forcesim = d3.forceSimulation()
      .force("x", d3.forceX(this.xdat).strength(1))
      .force("y", d3.forceY(this.yscale(0)))
      .force("collide", d3.forceCollide(this.R))
      .on("tick", ()=>{this.nudge()})
      .alphaDecay(decay)
      .nodes(discog)

    // Set initial position data
    // Add a bit of random jitter to initial y positions to break 
    // symmetry. 
    let jitterfn = d3.randomNormal(0, .1);
    discog.forEach(s=> {
      s.x = this.xdat(s);
      s.y = this.yscale(0+jitterfn());
    });

    let pts = this.svg.selectAll('.song').data(discog);
    pts.exit().remove();
    let newpts = pts
      .enter()
      .append("g")
      .on('mouseover', this.mouseover())
      .on('mouseout', this.mouseout())
      .classed("song bubble-container", true);
    let newcircles = newpts
      .append("circle")
      .attr("r", this.R)
      .attr("cx", 0)
      .attr("cy", 0)
    let fontsize = 10;
    let newtext = newpts
      .append("text")
      .classed("songlabel", true);
    pts = pts.merge(newpts);
    pts
      .attr("fill", s => comm.rscore_cmap(s.rscore));
    let textsel = pts.select('text');
    textsel
      .style("stroke", a=>d3.color(comm.rscore_cmap(a.rscore)).darker(1))
    this.bubbleText(textsel, d=>d.title);
  }

  // TODO: I miss being able to do arrow function methods. Should look into turning
  // that on in babel.
  // This was shunted to a helper factory method just because there's so much code.
  // Most of it is just a debugging tool (to see how far the forces move each point
  // from its original position)
  mouseover() {
    return (d,i,n) => {
      this.tip.show(d);
      if (DEBUG_DISPLACEMENT) {
        this.svg.select(".debugtrail").remove();
        this.svg.select(".ghost").remove();
        this.svg.append("line")
          .classed("debugtrail", true)
          .attr("stroke-width", 2)
          .attr("stroke", "black")
          .attr("x1", d.x)
          .attr("y1", d.y)
          .attr("x2", d.x)
          .attr("y2", d.y)
          .style('mouse-events', 'none')
          .transition()
          .ease(d3.easeLinear)
          .duration(500)
          .attr("x2", this.xdat(d))
          .attr("y2", this.yscale(0))
        this.svg
          .append("circle")
          .classed("ghost", true)
          .attr("r", this.R)
          .attr("opacity", 0)
          .attr("cx", this.xdat(d))
          .attr("cy", this.yscale(0))
          .attr("fill", "yellow")
          .style("mouse-events", "none")
          .transition()
          .delay(500)
          .duration(500)
          .attr("opacity", 0.5)
      }
    };
  }

  mouseout() {
    return (d,i,n) => {
      this.tip.hide(d);
      if (DEBUG_DISPLACEMENT) {
        this.svg.select(".debugtrail").remove();
        this.svg.select(".ghost").remove();
      }
    };
  }

  static init() {
    let disco = new DiscogWidget();
    return disco;
  }
}

export default DiscogWidget;
