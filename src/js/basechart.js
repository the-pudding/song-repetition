import * as d3 from 'd3';
import * as c from './constants.js';
import * as comm from './common.js';

class BaseChart {
  constructor(rootsel, kwargs={}) {
    this.rootsel = rootsel;
    this.root = d3.select(rootsel);
    this.margin = {top: 20, right: 20, bottom: 50, left: 20};
    Object.assign(this.margin, kwargs.margin);
    if (kwargs.W) {
      this.totalW = kwargs.W;
    } else {
      this.totalW = this.root.node().offsetWidth;
    }
    this.totalH = kwargs.H || 600;
    this.W = this.totalW - this.margin.left - this.margin.right;
    this.H = this.totalH - this.margin.top - this.margin.bottom;
    this._svg = this.root.append('svg')
      .attr('width', this.totalW)
      .attr('height', this.totalH)
    this.svg = this._svg
      .append("g")
        .attr("transform", "translate(" + this.margin.left + " " + this.margin.top + ")");
  }
}

class BeeswarmChart extends BaseChart {

  constructor(rootsel) {
    super(rootsel);
    this.R = 25; // radius of circles

    this.xscale = d3.scaleLinear()
      .domain(this.extent)
      .range([this.R, this.W-this.R]);
    this.yscale = d3.scaleLinear()
      .domain([-1, 1])
      .range([this.H-this.R, this.R]);
    this.addAxis();

  }

  addAxis() {
    let h = this.H-this.R;
    let labelh = h + this.H*5/20;
    this.svg.append("g")
      .classed("axis", true)
      .attr("transform", "translate(0 "+h+")");
    this.svg.append('text')
      .text('Less repetitive')
      .attr('font-size', '13px')
      .attr('x', this.W*1/20)
      .attr('y', labelh);
    this.svg.append('text')
      .text('More repetitive')
      .attr('font-size', '13px')
      .attr('x', this.W*9/10)
      .attr('y', labelh);
    this.updateAxis();
  }

  updateAxis() {
    let axis_el = this.svg.select('.axis');
    let axis = d3.axisBottom(this.xscale)
      .tickFormat(comm.rscore_to_readable);
    axis_el.call(axis);
  }

  bubbleText(textsel, textgetter, fontsize=11) {
    let spans = textsel.selectAll('tspan')
      .data(d=>this.linify(textgetter(d)));
    spans.exit().remove();
    let newspans = spans.enter().append('tspan');
    let lineheight = fontsize*1.05;
    spans.merge(newspans)
      .attr('fill', 'black')
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

  get extent() {
    return d3.extent(this.currData, this.getx);
  }
  get currData() {
    console.error('subclass must implement');
  }

  getx(datum) {
    console.error('subclass must implement');
  }
  datx(datum) {
    return this.xscale(this.getx(datum));
  }
}

export { BeeswarmChart, BaseChart };
