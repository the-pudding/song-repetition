import * as d3 from 'd3';
import * as c from './constants.js';

class BaseChart {
  constructor(rootsel) {
    this.root = d3.select(rootsel);
  }
}

class BeeswarmChart extends BaseChart {

  constructor(rootsel) {
    super(rootsel);
    let margin = {top: 20, right: 20, bottom: 50, left: 20};
    var totalW = 800;
    var totalH = 500;
    this.W = totalW - margin.left - margin.right;
    this.H = totalH - margin.top - margin.bottom;
    this.R = 25; // radius of circles
    this.svg = this.root.append('svg')
      .attr('width', totalW)
      .attr('height', totalH)
      .style('background-color', 'rgba(240,255,255,1)')
      .append("g")
        .attr("transform", "translate(" + margin.left + " " + margin.top + ")");

    this.xscale = d3.scaleLinear()
      .domain(this.extent)
      .range([this.R, this.W-this.R]);
    this.yscale = d3.scaleLinear()
      .domain([-1, 1])
      .range([this.H-this.R, this.R]);
    this.addAxis();

  }

  addAxis() {
    let h = this.H/2;
    this.svg.append("g")
      .classed("axis", true)
      .attr("transform", "translate(0 "+h+")");
    this.updateAxis();
  }

  updateAxis() {
    let axis_el = this.svg.select('.axis');
    let axis = d3.axisBottom(this.xscale);
    axis_el.call(axis);
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

export { BeeswarmChart };
