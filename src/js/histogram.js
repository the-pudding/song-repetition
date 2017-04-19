import * as d3 from 'd3';
import * as comm from './common.js';
import { BaseChart } from './basechart.js';
import HIST from './histogram-data.js';

var RSCORE_SCALE = 1;
const debug = 0;

class HistogramGraphic extends BaseChart {
  constructor(rootsel, to_drop) {
    super(rootsel, {H: 300});

    this.xaxis_y = this.H;
    // X-axis
    this.xaxis = this.svg.append('g')
      .attr('transform', 'translate(0,' + this.xaxis_y + ')');

    this.to_drop = to_drop;
    this.updateData();

    if (debug) {
      this.root.append('button')
        .classed('btn', true)
        .text('flip scale')
        .on('click', () => {
          // zzz hack
          RSCORE_SCALE = !RSCORE_SCALE;
          this.root.text('');
          new HistogramGraphic();
        })
      this.root.append('button')
        .classed('btn', true)
        .text(`Show ${this.dropped} more`)
        .on('click', () => {
          this.to_drop = 0;
          this.updateData();
          this.renderData();
        })
    }
    this.renderData();
  }

  updateData() {
    let dropped = 0;
    for (var i=1; i <= HIST.length; i++) {
      if (dropped >= this.to_drop) {
        break;
      }
      let bucket = HIST[HIST.length-i];
      dropped += bucket.count;
    }
    this.dropped= dropped;
    let dat = HIST.slice(0, HIST.length-i);
    this.dat = dat;
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

      this.xaxis.call(
        d3.axisBottom(_xscale)
        .tickFormat(tickFormat)
      )
  }

  renderData() {
    let dat = this.dat;
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
    new HistogramGraphic('#histogram', 20);
    new HistogramGraphic('#histogram-full', 0);
  }
}

export default HistogramGraphic;
