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

class CompressionGraphic {
  constructor() {
    // TODO: use a monospace font so we can use something like an x/y scale
    this.dittos = DITTOS;
    this.fontsize = 16;
    this.glyphwidth = 10;
    this.lineheight = this.fontsize*1.05;
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
    for (let line of LINES) {
      line = line.map((word,i)=> ({word:word, i:i+offset}));
      offset += line.length;
      linedat.push(line);
    }

    let lines = this.svg.selectAll('.line').data(linedat);
    let newlines = lines.enter()
      .append('text')
      .classed('line', true)
      .attr('font-size', this.fontsize)
      .attr('font-family', 'courier,monospace')
      .attr('x', 0)
      .attr('y', (d,i) => i*this.lineheight);
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
    if (nexti >= this.dittos.length || nexti < 0) {
      console.warn('no dittos left');
      return;
    }
    this.dittos[nexti].active = true;    
    console.log(this.dittos[nexti]);
    let dittos = this.svg.selectAll('.ditto').data(this.activeDittos);
    dittos.enter().each( (d,i,n) => this.ravel(d) );
    this.lastditto = nexti;
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

  ravel(d) { // ravel a ditto
    console.log(d);
    // src and dest may overlap. Do src first so dest has precedence.
    // highlight src section we're copying
    let src = this.selectRange(d.src, d.length);
    this.highlight(src, 'purple');
    // highlight section to be compressed
    let dest = this.selectRange(d.dest, d.length);
    this.highlight(dest, 'crimson');
    // make compressed section disappear
    dest
      .attr('opacity', 1)
      .transition()
      .duration(3000)
      .attr('opacity', .5);
    // add a marker in place of dest
    let where = this.locateRange(d.dest, d.length);
    let node = dest.node();
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
    console.log(where);
    let marker = this.svg.append('circle')
      .classed('ditto wordlike', true)
      .datum(d)
      .attr('cx', where.x)
      .attr('cy', where.y)
      .attr('r', 5)
      .attr('fill', 'red');
    // clear highlights
    this.clearHighlights(3000);
  }

  clearHighlights(delay) {
    this.svg.selectAll('.word')
      .transition()
      .delay(delay)
      .attr('fill', 'black');
  }

  highlight(sel, color='yellow') {
    // not transitionable :/
    if (false) {
    sel
      .attr('filter', `url(#filter${filter})`);
    return;
    }
    sel.transition()
      .duration(2000)
      .attr('fill', color);
  }

  selectRange(start, len) {
    return this.svg.selectAll('.word')
      .filter( 
          d => (d.i >= start && d.i < (start+len))
      );
  }

  static init() {
    let c = new CompressionGraphic();
  }
}

export default CompressionGraphic;
