import * as d3 from 'd3';
import * as c from './constants.js';
import * as comm from './common.js';
import { isMobile } from './helpers.js';

class BaseChart {
  constructor(rootsel, kwargs={}) {
    this.rootsel = rootsel;
    this.root = d3.select(rootsel);
    this.margin = {top: 20, right: 20, bottom: 50, left: 20};
    if (isMobile()) {
      this.margin.left = 0;
      this.margin.right = 0;
    }
    Object.assign(this.margin, kwargs.margin);
    if (kwargs.W) {
      this.totalW = kwargs.W;
    } else {
      this.totalW = this.root.node().offsetWidth;
    }
    if (kwargs.H) {
      this.totalH = kwargs.H;
    } else {
      // TODO: probably clearer and less dangerous to do this with css, using
      // vh units
      this.totalH = Math.min(
          800,
          window.innerHeight * (kwargs.hfrac || .66)
      );
      this.totalH = Math.max(
          this.totalH,
          kwargs.hmin || 300
      );
    }
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
    let R = isMobile() ? 22 : 27; // radius of circles
    let kwargs = {
      hmin: (R*2)*9,
    };
    super(rootsel, kwargs);
    this._svg.classed('beeswarm', true);
    this.R = R;

    this.xscale = d3.scaleLinear()
      .domain(this.extent)
      .range([this.R, this.W-this.R]);
    this.yscale = d3.scaleLinear()
      .domain([-1, 1])
      .range([this.H-this.R, this.R]);
    this.addAxis();

  }

  get ylabel() {
    return 'Size Reduction';
  }

  // render the x-axis
  addAxis() {
    let y = this.H;
    let labely = 30;
    this._svg.append("g")
      .classed("axis", true)
      .attr("transform", "translate(0 "+y+")")
      .append('text')
      .classed('label', true)
      .attr('transform', `translate(${this.W/2}, ${labely})`)
      .text(this.ylabel)
    this.updateAxis();
  }

  updateAxis() {
    let axis_el = this._svg.select('.axis');
    let axis = d3.axisBottom(this.xscale)
      .tickFormat(comm.rscore_to_readable);
    axis_el.call(axis);
  }

  /** Arrange text into the given text elements, such that they satisfactorily
   * fit into an enclosing 'bubble'. This may involve splitting text across
   * lines (using tspans) and possibly using a font size smaller than the one
   * suggested, or truncating some of the text.
   * - textsel is a selection of text elements, bound to some data.
   * - textgetter maps a bound datum on a text element to the associated
   *   text that should be drawn in the bubble
   * - fontsize is assumed to be in px. (Currently only used for line
   *   spacing. When we alter the font-size of the given text eles, we
   *   set it in % units)
   */
  bubbleText(textsel, textgetter, fontsize=11) {
    let linedat = textsel.data().map(d => this.linify(textgetter(d)));
    // Reduce font size per text according to max constraint violation
    let fontscale = d3.scaleLinear()
      .clamp(true)
      // No constraint violation: full font size. Exceeding the soft limit
      // on number of chars per line by 7 or more? 2/3 font size.
      .domain([0, 7])
      .range(['100%', '65%']);
    let fontsizer = (d,i) => fontscale(linedat[i].violation);
    textsel.style('font-size', fontsizer);

    let spans = textsel.selectAll('tspan')
      .data( (d,i) => linedat[i].lines );
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
  linify(s, maxlen=6) {
    // if we're going to go past one of these limits, we just give up and
    // stick in an ellipsis
    // (Also, yeah, I know, counting characters is imperfect here cause I'm
    // not using a monospace font, but the alternative of continually rendering
    // and checking sizes sounds tedious, and possibly slow)
    const hardlimit = {chars: 20, lines: 5};
    let tokens = s.split(' ');
    // this is an optimistic estimate
    let tentativesize = d3.sum(tokens, t=>t.length);
    // Basic idea here is that, if we know we're going to have to cut this
    // off early, then do it plenty early. Avoid the awkward situation where
    // the title came in just over the limit, and we end up rendering almost
    // the whole title, except a tiny bit at the end that gets ellipsised
    // (e.g. "Bang Bang (My Baby Show Me...")
    const charlimit = tentativesize > hardlimit.chars ?
      hardlimit.chars*.66 : 100;
    let lines = [];
    let line = '';
    let violation = 0;
    console.assert(maxlen > 0);
    let i = 0;
    let totallen = 0;
    let fedup = false;
    for (let token of tokens) {
      let wordsleft = (i+1) < tokens.length;
      // We've hit our hard limit. Add an ellipsis then peace out.
      if (wordsleft && totallen > charlimit) {
        fedup = true;
        line += '...';
      } else {
        line += token + ' ';
      }
      if (line.length >= maxlen || fedup ||
          // look ahead for icebergs
          (line.length && wordsleft &&
            (line.length + tokens[i+1].length) > maxlen * 1.33
          )
       )
      {
        line = line.slice(0,-1);
        if (!fedup && lines.length+1 >= hardlimit.lines) {
          line += '...';
          fedup = true;
        }
        lines.push(line)
        let len = line.length;
        violation = Math.max(violation, len-maxlen);
        totallen += len;
        line = '';
      }
      i++;
      if (fedup) break;
    }
    if (line) {
      lines.push(line);
    }
    return {lines, violation};
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
