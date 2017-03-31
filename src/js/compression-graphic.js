import * as d3 from 'd3';

let badromance = [
  {raw: "I want your ugly"},
  {raw: "I want your disease", dittos: [ 
    {
      local: {i0: 0, i1: 12},
      src: {line0: 0, line1: 0, i0: 0, i1: 12}
    },
  ]},
];

class Compressed {
  constructor(lines) {
    this.lines = lines;
    this.dittos = []; // TODO: not sure if needed
    for (let line of lines) {
      this.dittos.concat(line.dittos);
    }
  }

  get spans() {
    // nested
    let spans = [];
    for (let line of this.lines) {
      let inner = [];
      let dittos = line.dittos.sort(Compressed.dittoCmp);
      if (!dittos) {
        inner.push({type: 'raw', text: line.raw});
      } else {
        for (var ditto of dittos) {
        }
      }
      spans.push(inner)
    }
    return spans;
  }

  static dittoCmp(d1, d2) {
    return d1.i0 - d2.i0;
  }


  static toy() {
    return new Compressed(badromance);
  }
}

class CompressionGraphic {

  constructor() {
    this.dat = Compressed.toy();
    let rootSelector = '#compression-graphic';
    this.root = d3.select(rootSelector);
    
    let margin = {top: 20, right: 20, bottom: 50, left: 20};
    var totalW = 800;
    var totalH = 500;
    this.W = totalW - margin.left - margin.right;
    this.H = totalH - margin.top - margin.bottom;
    this.svg = this.root.append('svg')
      .attr('width', totalW)
      .attr('height', totalH)
      .style('background-color', 'rgba(240,255,255,1)')
      .append("g")
        .attr("transform", "translate(" + margin.left + " " + margin.top + ")");

    this.root.append("button")
      .text("animate")
      .on("click", () => {this.step()});

    // TODO: yeah yeah, need to make sure we don't overflow
    this.lineheight = 20;
    this.xoffset = 0;
    this.yscale = (lineno) => (lineno * this.lineheight);
    this.ydat = (d,i) => (this.yscale(i));
  }

  step() {
    this.shrink = !this.shrink;
    // http://stackoverflow.com/a/6714140/262271
    let sx = this.shrink ? .2 : 5; // scale factor
    let sy = sx;
    let cx = 240, cy = 50;
    let mat = `matrix(${sx}, 0, 0, ${sx}, ${cx-sx*cx}, ${cy-sy*cy})`;
    let forest = d3.select('#forest')
    forest
      .transition()
      .duration(5000)
      .attr('transform', mat)
    forest.transition()
      .delay(4000)
      .duration(1000)
      .attr('opacity', 0);
    let t = forest.transition()
      .delay(5000)
      .attr('transform', null)
    t
      .select('textPath')
        .text('@')
    t
      .duration(1000)
      .attr('opacity', 1);
    return;
    let line = this.svg.select('.line');
    let len = line.node().getComputedTextLength();
    line
      .attr('textLength', len)
      .transition()
      .duration(9000)
      .attr('textLength', 1);
  }

  renderRaw() {
    
    var lines = this.svg.selectAll('.line').data(this.dat.lines);
    // XXX ??? 
    lines
      .enter()
      .append("text")
      .classed("line", true)
      .text((d)=>(d.raw))
      .attr('lengthAdjust', 'spacingAndGlyphs')
      .attr("x", this.xoffset)
      .attr("y", this.ydat);

    return;
    var spans = lines.selectAll('tspan')
      .data((d)=>(d)); // array of spans for a given line

  }

  static init() {
    let g = new CompressionGraphic();
    g.renderRaw();
    return g;
  }
}

export default CompressionGraphic;

