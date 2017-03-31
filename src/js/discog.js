/** Widget for showing repetitiveness of an individual artist's discography
 */
import * as d3 from 'd3';
import d3Tip from 'd3-tip';

import ARTIST_LOOKUP from './starmap.js';

const DEBUG_DISPLACEMENT = false;

// Quantiles of repetition score
const pctiles = {
  10: 0.5388,
  50: 0.9733,
  90: 1.467
};

// Default limits for the rscore axis
const RLIM = [pctiles[10], pctiles[90]];

function round(x) {
  return Math.round(x*100)/100;
}
function songToolTip(s) {
  return `<div class="d3-tip">
      <div>${s.title} (${Math.floor(s.yearf)})</div>
      <div>${round(s.rscore)}</div>
      </div>`;
}

class DiscogWidget {

  // TODO: a general pattern worth trying: use setters to handle the rerendering 
  // associated with certain state changes (setting beehive, setting artist, etc.)
  constructor() {
    // Right now can flip between a beehive plot and one where x=date, y=rscore
    this.beehive = true;
    this.tip = d3Tip().html((d) => (songToolTip(d)));
    let rootsel = '#discog-widget';
    this.root = d3.select(rootsel);
    this.root.append("h1");
    let controls = this.root.append("div");
    controls.append("label")
      .text("Beehive")
        .append("input")
        .attr("type", "checkbox")
        .attr("checked", this.beehive ? true : null)
        .on("change", ()=>{
          this.toggleBeehive();
          this.renderSongs();
        });
    controls.append("button")
      .text("random artist")
      .on("click", ()=> {
        this.updateArtist();
      });

    let margin = {top: 20, right: 20, bottom: 50, left: 20};
    var totalW = 800;
    var totalH = 500;
    this.W = totalW - margin.left - margin.right;
    this.H = totalH - margin.top - margin.bottom;
    this.R = 25;
    this.svg = this.root.append('svg')
      .attr('width', totalW)
      .attr('height', totalH)
      .style('background-color', 'rgba(240,255,255,1)')
      .append("g")
        .attr("transform", "translate(" + margin.left + " " + margin.top + ")");
    this.svg.call(this.tip);
    
    let artist = 'Bruno Mars';
    this.setupAxes();
    this.updateArtist(artist);
  }

  // TODO: this is all kind of a mess right now. Need to structure it better
  // and make it more d3 idiomatic
  setupAxes() {
    if (!this.beehive) return;
    this.rextent = this.rextent || RLIM;
    this.xscale = d3.scaleLinear()
      .domain(this.rextent)
      .range([this.R, this.W-this.R]);
    let xaxis_ypos = this.H*9/10;
    this.svg.append("g")
        .classed("axis", true)
        .attr("transform", "translate(0 " + xaxis_ypos + ")")
        .call(d3.axisBottom(this.xscale).ticks(10));

      let offset = 100;
    let marker_pctiles = [10, 50, 90];
    let base = this.svg.selectAll(".baseline").data(marker_pctiles)
      .enter()
      .append("g")
      .classed("baseline", true);
    base.append("line")
      .attr("x1", (k)=>this.xscale(pctiles[k]))
      .attr("y1", xaxis_ypos)
      .attr("x2", (k)=>this.xscale(pctiles[k]))
      .attr("y2", offset)
      .attr("stroke", "black")
      .attr("stroke-width", 1);
    base.append("text")
      .attr("text-anchor", "middle")
      .attr("x", (k)=>this.xscale(pctiles[k]))
      .attr("y", offset-5)
      .attr("font-size", 12)
      .text((k) => (k === 50 ? "median" : k+"%"));
  }

  updateAxes() {
    if (!this.beehive) return;
    this.svg.select('.axis')
        .call(d3.axisBottom(this.xscale).ticks(10));

    this.svg.selectAll('.baseline').select('line')
      .transition()
      .duration(1000)
      .attr("x1", (k)=>this.xscale(pctiles[k]))
      .attr("x2", (k)=>this.xscale(pctiles[k]));
    this.svg.selectAll('.baseline').select('text')
      .transition()
      .duration(1000)
      .attr("x", (k)=>this.xscale(pctiles[k]));

  }

  toggleBeehive() {
    this.beehive = !this.beehive;
    if (!this.beehive) {
      this.svg.selectAll(".axis").remove();
      this.svg.selectAll(".baseline").remove();
    }
    if (this.beehive) {
      this.setupAxes();
    }
  }

  // Called to adjust circle positions when force simulation ticks
  nudge() {
    this.svg.selectAll(".song")
      .attr("transform", (d)=>("translate("+d.x+" "+d.y+")"));
  }

  // Use the given artist's discog. (Or, if none given, choose a random artist.)
  updateArtist(artist) {
    if (!artist) {
      let artists = Object.keys(ARTIST_LOOKUP);
      let i = Math.floor(Math.random()*artists.length);
      artist = artists[i];
    }
    this.root.select("h1")
      .text(artist + " discography");
    this.artist = artist;
    let url = 'assets/discogs/' + ARTIST_LOOKUP[this.artist];
    d3.json(url, (discog) => {
      this.discog = discog;
      this.renderSongs();
    });
  }

  renderSongs() {
    let discog = this.discog;
    let yrkey = (s) => (s.yearf);
    let rkey = (s) => (s.rscore);
    let xkey = this.beehive ? rkey : yrkey;
    let ykey = this.beehive ? ()=>0 : rkey;
    let rextent = d3.extent(discog, rkey);
    rextent[0] = Math.min(rextent[0], RLIM[0]);
    rextent[1] = Math.max(rextent[1], RLIM[1]);
    let yrextent = d3.extent(discog, yrkey);
    this.rextent = rextent;

    this.xscale = d3.scaleLinear()
      .domain(this.beehive ? rextent : yrextent)
      .range([this.R, this.W-this.R]);
    let ydomain = this.beehive ? [-1,1] : rextent;
    this.yscale = d3.scaleLinear()
      .domain(ydomain)
      .range([this.H-this.R, this.R]);
    // TODO: enough reuse going on at this point to consider some kind of helper
    // base class/mixin. Lots of duplication with artists.js.
    this.xdat = (d) => (this.xscale(xkey(d)));
    this.ydat = (d) => (this.yscale(ykey(d)));
    this.updateAxes();

    this.forcesim = d3.forceSimulation()
      .force("x", d3.forceX(this.xdat).strength(this.beehive ? 1 : .1))
      .force("y", d3.forceY(this.ydat))
      .force("collide", d3.forceCollide(this.R))
      .on("tick", ()=>{this.nudge()})
      .nodes(discog)
    
    // TODO: axes

    let pts = this.svg.selectAll('.song').data(discog);
    pts.exit().remove();
    let newpts = pts
      .enter()
      .append("g")
      .on('mouseover', this.mouseover())
      .on('mouseout', this.mouseout())
      .classed("song", true);
    let newcircles = newpts
      .append("circle")
      .attr("r", this.R) 
      .attr("cx", 0) 
      .attr("cy", 0)
      .attr("fill", "lightseagreen");
    let fontsize = 11;
    let newtext = newpts
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", fontsize)
      .attr("font-family", "Tahoma, Verdana, sans-serif")
      .classed("songlabel", true);
    // Some things we want to do both to new nodes and updated ones
    for (let sel of [newpts, pts]) {
      sel
        .attr("transform", d=>("translate("+this.xdat(d)+" "+this.ydat(d)+")"))
    }
    let spans = this.svg.selectAll('.songlabel').data(discog)
      .selectAll('tspan').data(d=>this.linify(d.title));
    spans.exit().remove();
    let newspans = spans
      .enter()
      .append("tspan");
    let lineheight = fontsize*1.05;
    for (let spansel of [spans, newspans]) {
      spansel
        .attr("x", 0)
        .attr("y", (d,i,n) => {
          let nlines = n.length;
          let height = nlines * lineheight;
          // -height/2 would make sense if text grew down from its y-coordinate,
          // but actually, the base of each letter is aligned with the y-coord
          let offset = -height/2 + lineheight/2;
          return offset + i*lineheight;
        })
        .text((d)=>d)
    }
  }

  /** Return a list of word-wrapped lines that sum to the given text.
   * Given max length is treated as a soft constraint. */
  linify(s, maxlen=5) {
    let tokens = s.split(' ');
    let lines = [];
    let line = '';
    console.assert(maxlen > 0);
    let i = 0
    for (let token of tokens) {
      line += token + ' ';
      if (line.length >= maxlen || 
          // look ahead for icebergs
          (line.length && (i+1) < tokens.length && 
            (line.length + tokens[i+1].length) > maxlen * 1.75
          )
         ) {
        lines.push(line.slice(0,-1));
        line = '';
      }
      i++;
    }
    if (line) {
      lines.push(line);
    }
    return lines;
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
          .attr("y2", this.ydat(d))
        this.svg
          .append("circle")
          .classed("ghost", true)
          .attr("r", this.R)
          .attr("opacity", 0)
          .attr("cx", this.xdat(d))
          .attr("cy", this.ydat(d))
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

