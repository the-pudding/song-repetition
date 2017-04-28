import * as d3 from 'd3';
import * as comm from './common.js';
import { BaseChart } from './basechart.js';
import HIST from './histogram-data.js';

let animation_dur = 1000;

const vline_dat = [
  {text: 'This Essay', rscore: comm.pct_to_rscore(10.8)},
  {text: 'Avg. song', rscore:.995},
  //{text: 'Bad Romance', rscore: 2.028},
  {text: 'Cheap Thrills', rscore: comm.pct_to_rscore(76.2)},
];

class HistogramGraphic extends BaseChart {
  constructor(rootsel, to_drop, kwargs={}) {
    super(rootsel, kwargs);
    this.xaxis_y = this.H;
    // X-axis
    this.xaxis = this.svg.append('g')
      .attr('transform', 'translate(0,' + this.xaxis_y + ')');
    // X-axis label
    this.svg.append('text')
      .attr('transform', `translate(${this.W/2}, ${this.xaxis_y+50})`)
      .attr('text-anchor', 'middle')
      .text('Size Reduction')
      .attr("class","xaxis-label")
      ;

    if (kwargs.hide_title) {
      // Still need to leave some room for vline labels
      this.maxbar_y = this.H*.1;
    } else {
      // title + subtitle
      this.maxbar_y = this.H * .3;
      this.svg.append('text')
        .classed('title', true)
        .text('The Repetition of Pop Music')
        .attr('text-anchor', 'middle')
        .attr('x', this.W/2)
        .attr('y', 0);
      let st = `Distribution of compressibility of 15,000 songs from 1958 to 2017, excluding 20 outliers.`;
      this.svg.append('text')
        .classed('subtitle', true)
        .attr('text-anchor', 'middle')
        .attr('x', this.W/2)
        .attr('y', this.maxbar_y*.3)
        .text(st);
    }
    this.xmax = (kwargs.xmax_ratio || 1) * this.W;
    this.min_barheight = 2;
    this.to_drop = to_drop;
  }

  updateData() {
    let dropped = 0;
    for (var i=0; i <= HIST.length; i++) {
      if (dropped >= this.to_drop) {
        break;
      }
      let bucket = HIST[HIST.length-1-i];
      dropped += bucket.count;
    }
    this.dropped= dropped;
    let dat = HIST.slice(0, HIST.length-i);
    this.dat = dat;
    let ydom = [0, d3.max(dat, h=>h.count)];
    this.yscale = d3.scaleLinear()
      .domain(ydom)
      .range([this.xaxis_y, this.maxbar_y]);
    this.hscale = d3.scaleLinear()
      .domain(ydom)
      .range([0, (this.xaxis_y-this.maxbar_y)]);

    let xdom = [dat[0].left, dat[dat.length-1].right];
    this.xscale = d3.scaleLinear()
      .domain(xdom)
      .range([0, this.xmax])
    let _xscale = this.xscale;
    let tickFormat = comm.rscore_to_readable;

    this.xaxis.call(
      d3.axisBottom(_xscale)
      .tickFormat(tickFormat)
      .tickSizeOuter(0)
      .tickSizeInner(4)
      .tickPadding(6)

    );
    this.renderData();
    this.renderVlines();
  }

  vlineData() {
    return vline_dat;
  }

  renderVlines() {
    let vlines = this.vlineData();
    // Match each vline to a corresponding bar
    let buckets = vlines.map(vl => {
      return HIST.find(buck =>
        (buck.left <= vl.rscore && vl.rscore <= buck.right)
        );
    });
    let containers = this.svg.selectAll('.vline').data(vlines);
    let newlines = containers.enter()
      .append('g')
      .classed('vline', true);
    let [bottom, top] = [10, 10];
    let ypad = -6;
    let linesize = ypad * -2;
    let bary = i => this.yscale(buckets[i].count);
    newlines.append('line')
      .attr('stroke', "black")
      .attr('stroke-width', 1)
      .attr('y1', (d,i) => bary(i)+ypad)
      .attr('y2', (d,i) => bary(i)+ypad-linesize)
    newlines.append('text')
      .attr('y', (d,i) => bary(i)+ypad*2-linesize)
      .attr('font-size', 12)
      .attr('text-anchor', 'middle')
      .text(v=>v.text)
    this.svg.selectAll('.vline line')
      .transition()
      .duration(animation_dur)
      .attr('x1', v=>this.xscale(v.rscore))
      .attr('x2', v=>this.xscale(v.rscore));
    this.svg.selectAll('.vline text')
      .transition()
      .duration(animation_dur)
      .attr('x', v=> this.xscale(v.rscore) + 5)
  }

  renderData() {
    let dat = this.dat;
    let bars = this.svg.selectAll('.bar').data(dat);
    bars.exit().remove();
    let newbars = bars.enter()
      .append('rect')
      .classed('bar', true);
    bars.merge(newbars)
      .attr('fill', h => comm.rscore_cmap((h.left+h.right)/2) )
      .attr('y', h=> h.count === 0 ?
          this.yscale(h.count)
          :
          Math.min(this.xaxis_y-this.min_barheight, this.yscale(h.count))
          )
      .transition()
      .duration(animation_dur)
      .attr('x', h=> this.xscale(h.left))
      .attr('width', h=> this.xscale(h.right) - this.xscale(h.left))
      .attr('height', h=> h.count === 0 ?
          this.hscale(h.count)
          :
          Math.max(this.min_barheight, this.hscale(h.count))
          )

  }

  static init() {
    let h = new HistogramGraphic('#histogram', 20, {H: 400});
    h.updateData();
  }
}

export default HistogramGraphic;
