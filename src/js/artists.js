import * as d3 from 'd3'
import artists from './artist-data.js';
import d3Tip from 'd3-tip';
  
var data = artists;

var decades = [];
for (let d=8; d<=11; d++) {
  let name;
  if (d === 11) {
    name = "10's";
  } else if (d === 10) {
    name = "00's";
  } else {
    name = d*10 + "'s";
  }
  let decade = {earliest: 1900+d*10, latest: 1900+d*10+9, name: name};
  decades.push(decade);
}

function round(x) {
  return Math.round(x*100)/100;
}

function artistTooltip(a) {
  var lines = [];
  let s = '<div class="artist-tooltip d3-tip n">'
  for (let attr of ["name", "rscore", "year", "nsongs", "mostrep"]) {
    let val = a[attr];
    if (attr === 'rscore') {
      val = round(val);
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

class ArtChart {
  constructor() {
    this.tip = d3Tip().html((d) => (artistTooltip(d)));

    this.root = d3.select('#artist-circles');
    let margin = {top: 20, right: 20, bottom: 50, left: 20};
    var totalW = 800;
    var totalH = 500;
    this.W = totalW - margin.left - margin.right;
    this.H = totalH - margin.top - margin.bottom;
    this.R = 25; // radius of artist circles
    this.svg = this.root.append('svg')
      .attr('width', totalW)
      .attr('height', totalH)
      .style('background-color', 'rgba(240,255,255,1)')
      .append("g")
        .attr("transform", "translate(" + margin.left + " " + margin.top + ")");
    this.svg.call(this.tip)

    this.decade = decades[decades.length-1];
    // TODO: redo on decade change?
    this.xscale = d3.scaleLinear()
      .domain(d3.extent(data, (d)=> (d.rscore)))
      .range([0, this.W - 2*this.R]); // subtract width of an artist marker
    this.yscale = d3.scaleLinear()
      .domain([-1, 1])
      .range([0, this.H]);
    var xaxis = d3.axisBottom(this.xscale).ticks(5);
    this.svg.append("g")
      .classed("axis", true)
      .call(xaxis);


    this.forcesim = d3.forceSimulation()
      .force("x", d3.forceX( (a) => (this.xscale(a.rscore))).strength(1))
      .force("y", d3.forceY(this.yscale(0)))
      .force("collide", d3.forceCollide(this.R))
      .on("tick", ()=>{this.nudgeArtists()});

    this.setupControls();
    this.rerender();
  }

  setupControls() {
    this.controls = this.root.append('form');
    this.inputs = this.controls.selectAll("input").data(decades)
      .enter()
      .append("label")
      .text((d)=>(d.name))
      .append("input")
      .attr("name", "decade")
      .attr("type", "radio")
      .attr("checked", (d) => (this.decade === d || null))
      .on("change", (datum) => {
        this.decade = datum;
        this.rerender();
      });
  }

  updateDecadeControls() {
    this.inputs.attr("checked", (d) => (this.decade === d || null));
  }

  // Called on init and when data changes (e.g. by user selecting a new decade)
  // Updates set of artist circles and their positions
  rerender() {
    console.log('rerender');
    this.updateDecadeControls();
    this.updateCurrData();
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
    var artist_x = (a) => (this.xscale(a.rscore));
    var artist_y = this.yscale(0);
    var a = this.svg.selectAll(".artistNode").data(this.currData);
    var containers = a.enter()
      .append("g")
      .attr("width", this.R*2) // TODO: not necessary?
      .attr("height", this.R*2)
      .on('mouseover', this.tip.show)
      .on('mouseout', this.tip.hide)
      .classed("artistNode", true);
    containers
      .append("circle")
      .attr("fill", "aqua")
      .attr("r", this.R)
      .attr("cx", 0)
      .attr("cy", 0);
    // TODO: make text not overflow container
    containers
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", 8)
      .attr("font-family", "verdana")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", this.R*2)
      .attr("height", this.R*2)
      .text((a) => (a.name));
    // update text labels
    a.select("text")
      .text((a) => (a.name));
    a.exit().remove();
  }

  updateCurrData() {
    // Reapply decade filter
    var curr = data.filter( (d) => 
        (d.year >= this.decade.earliest && d.year <= this.decade.latest)
    );
    // Set initial positions
    curr.forEach((d) => {
      d.x = this.xscale(d.rscore);
      d.y = this.yscale(0);
    });
    this.currData = curr;
  }

  static init() {
    var chart = new ArtChart();
  }
}

export default ArtChart;
