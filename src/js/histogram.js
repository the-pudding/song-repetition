import * as d3 from 'd3';
import * as comm from './common.js';
import { BaseChart } from './basechart.js';
import HIST from './histogram-data.js';

var RSCORE_SCALE = 1;

class HistogramGraphic extends BaseChart {
  constructor() {
    let rootsel = '#histogram';
    super(rootsel, {H: 300});

    let dat = HIST;

    this.xaxis_y = this.H;
    let ydom = [0, d3.max(dat, h=>h.count)];
    this.yscale = d3.scaleLinear()
      .domain(ydom)
      .range([this.xaxis_y, 0]);
    this.hscale = d3.scaleLinear()
      .domain(ydom)
      .range([0, this.xaxis_y]);

    let xdom = [dat[0].left, dat[dat.length-1].right];
    this.xscale = d3.scaleLinear()
      .domain(xdom)
      .range([0, this.W])
    let _xscale = this.xscale;
    let tickFormat = comm.rscore_to_readable;

    if (!RSCORE_SCALE) {
      xdom = xdom.map(comm.rscore_to_pct);
      _xscale = this.xscale.domain(xdom);
      this.xscale = rs => _xscale(comm.rscore_to_pct(rs));
      tickFormat = d3.format('.0%');
    }

    // X-axis
    this.svg.append('g')
      .attr('transform', 'translate(0,' + this.xaxis_y + ')')
      .call(
        d3.axisBottom(_xscale)
        .tickFormat(tickFormat)
      )

    this.renderData();

    this.root.append('button')
      .classed('btn', true)
      .text('flip scale')
      .on('click', () => {
        // zzz hack
        RSCORE_SCALE = !RSCORE_SCALE;
        this.root.text('');
        new HistogramGraphic();
      })
  }

  renderData() {
    let dat = HIST;
    let bars = this.svg.selectAll('.bar').data(dat);
    bars.exit().remove();
    let newbars = bars.enter()
      .append('rect')
      .classed('bar', true);
    bars.merge(newbars)
      .attr('fill', 'fuchsia')
      .attr('x', h=> this.xscale(h.left))
      .attr('y', h=> this.yscale(h.count))
      .attr('width', h=> this.xscale(h.right) - this.xscale(h.left))
      .attr('height', h=> this.hscale(h.count))

  }

  static init() {
    let g = new HistogramGraphic();
    return g;
  }
}

export default HistogramGraphic;
