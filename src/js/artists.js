import * as d3 from 'd3'
import * as c from './constants.js';
import * as comm from './common.js';
import artists from './artist-data.js';
import d3Tip from 'd3-tip';
import { BeeswarmChart } from './basechart.js';
import { decade_controls } from './helpers.js';
import { isMobile } from './helpers.js';

var data = artists;

// This kinda sucks.
const max_artists = isMobile() ? 35 : 50;

function round(x) {
  return Math.round(x*100)/100;
}

function debugartistTooltip(a) {
  var lines = [];
  let s = '<div class="artist-tooltip n">'
  for (let attr of ["name", "rscore", "year", "nsongs", "mostrep"]) {
    let val = a[attr];
    if (attr === 'rscore') {
      val = round(val);
      let pct = Math.pow(2, -val)*100;
      s += `<div>pct: ${round(pct)}</div>`;
    }
    if (attr === 'mostrep') {
      val += ' (' + round(a['topscore']) + ')';
    }
    let txt = attr + ' = ' + val;
    s += '<div>' + txt + '</div>';
  }
  s += '</div>';
  return s;
}

function artistTooltip(a) {
  var lines = [];
  let s = '<div class="artist-tooltip d3-tip n">';

  // lines.push(a.name);
  //lines.push(`#songs: ${a.nsongs}`);
  lines.push(`avg. repetition: ${comm.rscore_to_readable(a.rscore)}`);
  lines.push(`#1 repetitive: ${a.mostrep} (${comm.rscore_to_readable(a.topscore)})`);
  s += lines.map(t=>`<div>${t}</div>`).join('');
  s += '</div>';
  return s;
}

class ArtChart extends BeeswarmChart {
  constructor() {
    super('#artist-circles');
    this.tip = d3Tip().html((d) => (artistTooltip(d)));
    this.svg.call(this.tip);

    // default to 00's
    this.decade = c.pseudo_decades[2];
    // TODO: redo on decade change?
    this.forcesim = d3.forceSimulation()
      .force("x", d3.forceX( (a) => (this.xscale(a.rscore))).strength(1))
      .force("y", d3.forceY(this.yscale(0)))
      // Add a bit of virtual padding to circles
      .force("collide", d3.forceCollide(this.R+1))
      .on("tick", ()=>{this.nudgeArtists()});
    this.setupControls();
    this.rerender();
  }

  get ylabel() {
    return 'Avg. Size Reduction';
  }

  get currData() {
    if (!this.decade) { // XXX: hack
      return data;
    }
    // Reapply decade filter
    var curr = data.filter( (d) =>
        (d.year >= this.decade.earliest && d.year <= this.decade.latest)
    );
    if (curr.length > max_artists) {
      curr = curr.sort((a,b) => d3.descending(a.nsongs, b.nsongs));
      curr = curr.slice(0, max_artists);
    }
    // Set initial positions
    curr.forEach((d) => {
      d.x = this.xscale(d.rscore);
      d.y = this.yscale(0);
    });
    return curr;
  }
  getx(d) { return d.rscore; }

  setupControls() {
    let controls = this.root.select('.decade-controls');
    this.inputs = decade_controls(controls)
      .on("click", (datum) => {
        this.decade = datum;
        this.rerender();
      });
    this.updateDecadeControls();
  }

  updateDecadeControls() {
    this.inputs.classed("active", d => this.decade === d);
  }

  // Called on init and when data changes (e.g. by user selecting a new decade)
  // Updates set of artist circles and their positions
  rerender() {
    this.updateDecadeControls();
    this.renderArtists();
    // alpha(1) "reheats" the simulation. Why does that work but .restart()
    // doesn't? I have no idea. :/
    // Okay, apparently both restart *and* alpha are necessary. idkkkkk
    this.forcesim.nodes(this.currData)
      .restart()
      .alpha(1);
  }

  nudgeArtists() {
    this.svg.selectAll(".artistNode")
      .attr("transform", (d)=>("translate("+d.x+" "+d.y+")"));
  }

  renderArtists() {
    var a = this.svg.selectAll(".artistNode").data(this.currData);
    a.exit().remove();
    var containers = a.enter()
      .append("g")
      .attr("width", this.R*2) // TODO: not necessary?
      .attr("height", this.R*2)
      .on('mouseover', this.tip.show)
      .on('mouseout', this.tip.hide)
      .classed("artistNode bubble-container", true);
    containers
      .append("circle")
      .attr("r", this.R)
      .attr("cx", 0)
      .attr("cy", 0);
    a.merge(containers).select('circle')
      .attr("fill", a=>comm.rscore_cmap(a.rscore))
    // TODO: using containers rather than this.svg.select causes an inscrutable
    // error when doing a decade switch:
    //  Cannot read property 'ownerDocument' of null
    // may want to file a bug on that?
    let fontsize = this.svg.select('.artistNode').style('font-size');
    // (I'm assuming the above will always return a size in px)
    containers
      .append("text")
      // TODO: currently redundant wrt bubbleText
      .style("font-size", fontsize)
      .attr("class","artists-bubble-text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", this.R*2)
      .attr("height", this.R*2)
      .style("stroke", a=>d3.color(comm.rscore_cmap(a.rscore)).darker(1))
      ;
    let textsel = a.merge(containers).select('text');
    this.bubbleText(textsel, a=>a.name, parseInt(fontsize));
  }

  static init() {
    var chart = new ArtChart();
  }
}

export default ArtChart;
