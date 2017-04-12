import * as d3 from 'd3';
import LINES from './lines.js';
import DITTOS from './dittos.js';


/** Implementation brainstroming
 *
 * - Maybe the final processed data we're working with/binding to here is 
 *   just a collection of text 'spans'. Yah, could work.
 *
 * Main idea:
 * - for each ditto:
 *      - highlight it, highlight src, shrink ditto to a dot
 * - when hovering a ditto, show an arrow back (and simulate decompress?)
 * - defragmenting
 *     - could do as we go, or once at the very end
 *
 * - limit to word matches?
 *      - otherwise might need element per character. Crazy?
 *
 * Maybe as part of the preprocessing step, chunk the text into pieces that are
 * significant for compression/decomp?
 *      But might these be overlapping? Yeah.
 *
 * Another animation idea:
 *      - start with full lyrics
 *      - go through dittos, and make them pale, doing the highlight thing
 *      - ...?
 */

const ravel_stages = [
  {upto: 0},
  {upto: -1}
];

const src_color = 'purple';
const dest_color = 'darkgreen';

class CompressionGraphic {
  constructor() {
    // TODO: use a monospace font so we can use something like an x/y scale
    this.dittos = DITTOS;
    this.fontsize = 16;
    // pretty close
    this.glyphwidth = 9.6;
    this.lineheight = this.fontsize*1.05;
    // scaling for circle markers
    this.x = {
      underline: x => (this.glyphwidth * x),
      marker: x => (this.glyphwidth * x) + this.glyphwidth/2
    }
    this.y = {
      marker: y => (this.lineheight * y) - this.lineheight * .25,
      text: y => (this.lineheight * y)
    };
    this.root = d3.select('#compression');

    let butcon = this.root.append('div');
    butcon
      .append('button')
      .classed('btn', true)
      .text('step')
      .on('click', ()=>{this.step()});
    butcon
      .append('button')
      .classed('btn', true)
      .text('unstep')
      .on('click', ()=>{this.unstep()});

    let margin = {top: 20, right: 20, bottom: 50, left: 40};
    var totalW = 800;
    var totalH = 600;
    this.W = totalW - margin.left - margin.right;
    this.H = totalH - margin.top - margin.bottom;
    this.svg = this.root.append('svg')
      .attr('width', totalW)
      .attr('height', totalH)
      .style('background-color', 'rgba(255,240,255,1)')
      .append("g")
        .attr("transform", "translate(" + margin.left + " " + margin.top + ")");

    let defs = this.svg.append('defs');
    for (let color of ['yellow', 'khaki', 'lavender']) {
      let filter  = defs
        .append('filter')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 1)
        .attr('height', 1)
        .attr('id', 'filter'+color);
      filter.append('feFlood')
        .attr('flood-color', color);
      filter.append('feComposite')
        .attr('in', 'SourceGraphic');
    }

    this.raveled_to = undefined;
    this.renderText();
    this.lastditto = -1;
  }

  renderText() {
    // ZZZ. Store a global index per word.
    let linedat = [];
    let offset = 0;
    let y = 0;
    for (let line of LINES) {
      line = line.map((word,i)=> ({word:word, x:i, y:y}));
      offset += line.length;
      y += 1;
      linedat.push(line);
    }

    let lines = this.svg.selectAll('.line').data(linedat);
    let newlines = lines.enter()
      .append('text')
      .classed('line', true)
      .attr('font-size', this.fontsize)
      .attr('font-family', 'courier,monospace')
      .attr('alignment-baseline', 'middle') // seems not to do anything?
      .attr('x', 0)
      .attr('y', (d,i) => this.y.text(i));
    let words  = lines.merge(newlines)
      .selectAll('.word')
      .data(words=>words);
    words.enter()
      .append('tspan')
      .classed('word', true)
      .text(w=>w.word + ' ');
  }

  get activeDittos() {
    return this.dittos.filter(d=>d.active);
  }

  unstep(stage) {
    this.step(stage, -1);
  }

  step(stage, by=1) {
    console.log('steppin\'');
    let nexti = this.lastditto+by;
    console.log('nexti = ' + nexti);
    if (nexti >= this.dittos.length || nexti < -1) {
      console.warn('no dittos left');
      return;
    }
    this.lastditto = nexti;
    // TODO: could probably do this in one less step...
    this.dittos.forEach((d,i)=> {d.active = i <= this.lastditto});
    let dittos = this.svg.selectAll('.ditto').data(this.activeDittos);
    dittos.enter().each( (d,i,n) => this.ravel(d) );
    dittos.exit()
      .each( (d,i,n) => this.unravel(d,n[i]) )
      .remove();
  }

  // Return an x-y coord corresponding to this word range
  locateRange(start, len) {
    // TODO: lazy implementation
    // For now, just approximate the x,y coord of the first word in the range
    let y = 0;
    let seen = 0;
    for (let line of LINES) {
      let width = 0;
      for (let word of line) {
        if (seen === start) {
          // TODO: this way of calculating x doesn't really work
          return {y:y*this.lineheight, x: width*this.glyphwidth};
        }
        seen += 1;
        width += word.length + 1;
      }
      y += 1;
    }
    console.error("Couldn't find range");
  }

  unravel(d) {
    this.clearHighlights(3000);
    let dest = this.selectRange(d.dest);
    // cancel any ongoing transitions
    dest.transition();
    // Unhide the corresponding dest text
    dest.attr('opacity', 1);
  }

  ravel(d) { // ravel a ditto
    // highlight src section we're copying
    let src = this.selectRange(d.src);
    let dest = this.selectRange(d.dest);
    // clear prev highlights
    this.clearHighlights(3000);
    this.highlightSrc(d.src);
    this.highlightDest(d.dest);
    if (0) {
    src
      .attr('text-decoration', 'underline')
      .attr('stroke', src_color);
    // highlight section to be compressed
    //TODO: need to do like nested tspans to set line color different from
    //text color (http://tavmjong.free.fr/SVG/TEXT_DECORATION/)
    dest
      .attr('text-decoration', 'overline')
      .attr('stroke', dest_color);
    }
    dest
      .attr('opacity', 1)
      .transition()
      .duration(3000)
      .attr('opacity', .1);
    // add a marker in place of dest
    // XXX: replace me
    //let where = this.locateRange(d.dest, d.length);
    //let node = dest.node();
    //let where = dest.node().getBBox();
    // XXX 2: Maybe solution is to use (row, col) indices, rather than 
    // flattened indices. Yeah, probably.
    // XXX 2: Maybe just build a lookup table from flattened indices to 
    // coords? I guess that's basically what you had before.
    //debugger;
    // YOUAREHERE XXX ZZZZZZZZ
    // Okay, so I think insisting on word breaks and putting words in tspans
    // is doing you basically no good? 
    // Definitely need to figure out how to do math on text positioning, to
    // be able to adroidtly insert shapes over/around text, and do the compactification
    // stuff. Blurgh.
    let where = this.rangeCentroid(d.dest);
    let marker = this.svg.append('circle')
      .classed('ditto wordlike', true)
      .datum(d)
      .attr('cx', this.x.marker(where.x))
      .attr('cy', this.y.marker(where.y))
      .attr('r', 5)
      .attr('fill', 'red');
  }

  linewidth(y) {
    return d3.sum(LINES[y], s=>s.length);
  }

  // Return centroid of given range of text, in natural units
  rangeCentroid(range) {
    let yspan = range.y2 - range.y1;
    let x,y;
    // if it's all on the same line, this is easy
    if (yspan === 0) {
      y = range.y1;
      x = (range.x1+range.x2)/2;
    }
    // Goes on for many lines? Take the middle of the middle line
    else if (yspan > 1) {
      y = Math.floor( (range.y1+range.y2)/2 );
      x = this.linewidth(y)/2;
    }
    // Two lines? Put it on the middle of the occupied part of the first line
    else if (yspan === 1) {
      y = range.y1;
      x = (range.x1 + this.linewidth(y))/2;
    } else {
      console.error('Should not be reachable');
    }
    return {x,y};
  }

  clearHighlights(delay) {
    this.svg.selectAll('.underline').remove();
  }

  highlightSrc(range) {
    this.addTextLine(range, src_color);
  }
  highlightDest(range) {
    this.addTextLine(range, dest_color, this.lineheight * .3 );
  }

  addTextLine(range, color, yoffset=0) {
    let line = d3.line()
      .x( ([x,y]) => this.x.underline(x) )
      .y( ([x,y]) => this.y.text(y)+yoffset );
    // non-d3-idiomatic way of doing it
    for (let y=range.y1; y<=range.y2; y++) {
      let x1 = y === range.y1 ? range.x1 : 0;
      let x2 = y === range.y2 ? range.x2 : d3.sum(LINES[y], s=>s.length+1)-1;
      let linedat = [ [x1, y], [x2, y] ];
      this.svg.append('path')
        .classed('underline', true)
        .attr('stroke', color)
        .attr('stroke-width', 3)
        .attr('d', line(linedat));
    }
  }

  rangeContains(range, dat) {
    let gt = dat.y > range.y1 || (dat.y==range.y1 && dat.x >= range.x1word);
    let lt = dat.y < range.y2 || (dat.y==range.y2 && dat.x <= range.x2word);
    return gt && lt;
  }

  selectRange(range) {
    return this.svg.selectAll('.word')
      .filter( 
          d => this.rangeContains(range, d)
      );
  }

  static init() {
    let c = new CompressionGraphic();
  }
}

export default CompressionGraphic;
