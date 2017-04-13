import * as d3 from 'd3';
import LINES from './lines.js';
import DITTOS from './dittos.js';
import scroll_controller from './scroll.js';
import ScrollMagic from 'scrollmagic';

// TODO: think about ways of doing the animation that look better/are clearer
// in motion when scrolling.

const ravel_stages = [
  {upto: 0},
  {upto: -1}
];

const stages = [
  {start: 0, dur: 1},
  {start: 1, dur: 3, text: "hello"},
  {start: 4, dur: 3, text: "hello2"},
  {start: 7, dur: 85, free:true},
  {start: 95, dur: 5, final: true},
];

const src_color = 'purple';
const dest_color = 'darkgreen';

class CompressionGraphic {

  setScene() {
    let scene = new ScrollMagic.Scene({
        triggerElement: this.rootsel,
        triggerHook: 0,
        duration: 3200,
    })
    scene
      .setPin(this.rootsel)
      .addTo(this.controller)
      .on('progress', e=> this.onScroll(e.progress));
  }

  onScroll(progress, direction) {
    // TODO: progress should probably accelerate
    // TODO: maybe progress should scale with height rather than 
    // ditto #. And maybe have a cursor that slides down the text to
    // indicate where we've compressed up to?
    let slack = .1;
    let prog_per_ditto = (1-slack)/DITTOS.length;
    let i = Math.floor(progress/prog_per_ditto);
    this.setLastDitto(i);

    // TODO YOUAREHERE
    // see if progress is outside bounds of current stage. if so, change stage.
  }

  constructor() {
    this.stage = stages[0];
    this.controller = scroll_controller;
    this.dittos = DITTOS;
    this.fontsize = 16;
    // pretty close
    this.glyphwidth = 9.6;
    this.lineheight = this.fontsize*1.05;
    // scaling for various pieces of the graphic 
    this.x = {
      underline: x => (this.glyphwidth * x),
      marker: x => (this.glyphwidth * x) + this.glyphwidth/2
    }
    this.y = {
      marker: y => (this.lineheight * y) - this.lineheight * .25,
      text: y => (this.lineheight * y)
    };
    this.rootsel = '#compression';
    this.setScene();
    this.root = d3.select(this.rootsel);
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
    butcon
      .append('button')
      .classed('btn', true)
      .text('reset')
      .on('click', ()=>{this.step(null, -1000)});
    butcon
      .append('button')
      .classed('btn', true)
      .text('fast-forward')
      .on('click', ()=>{this.step(null, 1000)});

    let margin = {top: 20, right: 20, bottom: 50, left: 40};
    var totalW = 600;
    var totalH = 600;
    this.W = totalW - margin.left - margin.right;
    this.H = totalH - margin.top - margin.bottom;
    this.svg = this.root.append('svg')
      .attr('width', totalW)
      .attr('height', totalH)
      .style('background-color', 'rgba(255,240,255,1)')
      .append("g")
        .attr("transform", "translate(" + margin.left + " " + margin.top + ")");

    this.lastditto = -1;
    this.renderText();
  }

  renderText() {
    let linedat = [];
    let y = 0;
    for (let line of LINES) {
      line = line.map((word,i)=> ({word:word, x:i, y:y}));
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
    let newwords = words.enter()
      .append('tspan')
      .classed('word', true)
      .text(w=>w.word + ' ');
    newwords
      .datum(d=>({...d, visible:true}) );
  }

  get activeDittos() {
    return this.dittos.filter(d=>d.active);
  }

  unstep(stage) {
    this.step(stage, -1);
  }

  step(stage, by=1) {
    let nexti = this.lastditto+by;
    nexti = Math.min(this.dittos.length-1, nexti);
    nexti = Math.max(-1, nexti);
    if (nexti === this.lastditto) {
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

  setLastDitto(nexti) {
    nexti = Math.min(this.dittos.length-1, nexti);
    nexti = Math.max(-1, nexti);
    if (nexti === this.lastditto) {
      //console.warn('no dittos left');
      return;
    }
    this.lastditto = nexti;
    // TODO: could probably do this in one less step...
    this.dittos.forEach((d,i)=> {d.active = i <= this.lastditto});
    let dittos = this.svg.selectAll('.ditto').data(this.activeDittos);
    dittos.enter().each( (d,i,n) => this.ravel(d, 800) );
    dittos.exit()
      .each( (d,i,n) => this.unravel(d,n[i]) )
      .remove();
  }

  unravel(d) {
    console.log('Watch me unravel');
    //this.clearHighlights();
    let dest = this.selectRange(d.dest);
    // cancel any ongoing transitions
    dest.interrupt();
    // Unhide the corresponding dest text
    dest.attr('opacity', 1);
  }

  ravel(d, duration=3000) { // ravel a ditto
    // allocation of duration per phase
    const durs = {
      highlight: .3 * duration,
      fadeout: .4 * duration,
      fadein: .3 * duration,
    };
    // clear prev highlights
    //this.clearHighlights();
    // highlight src section we're copying
    let src = this.selectRange(d.src);
    let dest = this.selectRange(d.dest);
    this.highlightSrc(d.src, durs.highlight)
    this.highlightDest(d.dest, durs.highlight);
    let wait = durs.highlight;
    dest
      .attr('opacity', 1)
      .datum(d=>({...d, visible:false}) )
      .transition()
      .delay(wait)
      .duration(durs.fadeout)
      .ease(d3.easeLinear)
      .attr('opacity', .1);
    // TODO: I think there's a more elegant way to chain transitions
    wait += durs.fadeout;
    let where = this.rangeCentroid(d.dest);
    let marker = this.svg.append('circle')
      .classed('ditto wordlike', true)
      .datum(d)
      .attr('cx', this.x.marker(where.x))
      .attr('cy', this.y.marker(where.y))
      .attr('r', 5)
      .on('mouseover', (d,i,n)=>this.onMarkerHover(d,n[i]))
      .on('mouseout', ()=>this.clearHover())
      .attr('fill', src_color);
    // Fade in marker
    marker
      .attr('opacity', 0)
      .transition()
      .delay(wait)
      .duration(durs.fadein)
      .ease(d3.easeLinear)
      .attr('opacity', 1);
    // Fade out underline
    this.svg.selectAll('.underline')
      .transition()
      .delay(wait+durs.fadein/2) // TODO: just hacking around
      .duration(durs.fadein)
      .ease(d3.easeLinear)
      .attr('opacity', 0)
      .remove();
  }

  onMarkerHover(d, node) {
    // TODO: disable mouse events on arrow to prevent hijacking
    let dur = 200;
    let hoverbox = this.svg.append('g')
      .classed('hoverbox', true);
    this.highlightSrc(d.src, dur, hoverbox);
    let srctext = this.selectRange(d.src)
      .filter(d=>!d.visible);
    this.marked = [srctext];
    srctext
      .transition()
      .duration(dur)
      .ease(d3.easeLinear)
      .attr('stroke', 'orange')
      .attr('opacity', .6);

    let arrowdur = 1000;
    this.animateArrow(d, node, hoverbox, arrowdur);

    let desttext = this.selectRange(d.dest);
    this.marked.push(desttext);
    desttext
      .transition()
      .delay(dur+arrowdur)
      .duration(dur*2)
      .ease(d3.easeLinear)
      .attr('stroke', 'orange')
      .attr('opacity', .4);
  }

  clearHover() {
    for (let marked of this.marked) {
      marked
        .interrupt()
        .attr('stroke', 'none')
        .attr('opacity', .1);
    }
    this.marked = [];
    this.svg.selectAll('.hoverbox').remove();
  }

  animateArrow(d, node, root, duration) {
    // TODO: give this arrow a pointy end
    // TODO: should start from underline position, not where a marker would be
    let start = this.rangeCentroid(d.src);
    let end = this.rangeCentroid(d.dest);
    // TODO: this line-drawing algo can lead to some really wonky results for
    // points with similar x coords
    let inflection_x = (start.x + end.x)/2;
    let inflection_y = Math.max(start.y, end.y) + 
      Math.abs(start.x-start.y) * .3;
    let pts = [start, {x:inflection_x, y:inflection_y}, end];
    let line = d3.line()
      .curve(d3.curveNatural) // chosen arbitrarily
      .x(d=>this.x.marker(d.x))
      .y(d=>this.y.marker(d.y));
    let path = root.append('path')
      .classed('arrow', true)
      .attr('stroke', 'black')
      .attr('stroke-width', 3)
      .attr('fill', 'none')
      .attr('d', line(pts))
      .call(this.animatePath, duration);
  }

  // Return the length of the given line in characters.
  linewidth(y) {
    return d3.sum(LINES[y], s=>s.length) 
      + (LINES[y].length-1) // account for spaces between words
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

  highlightSrc(range, duration, root) {
    return this.addTextLine(range, src_color, duration, root);
  }
  highlightDest(range, duration, root) {
    return this.addTextLine(range, dest_color, duration, root);
  }

  // Add underline to a given range of text (using paths, not text-decoration)
  addTextLine(range, color, duration, root) {
    if (!root) {
      root = this.svg;
    }
    let line = d3.line()
      .x( ([x,y]) => this.x.underline(x) )
      .y( ([x,y]) => this.y.text(y) );
    // non-d3-idiomatic way of doing it
    for (let y=range.y1; y<=range.y2; y++) {
      let x1 = y === range.y1 ? range.x1 : 0;
      let x2 = y === range.y2 ? range.x2 : d3.sum(LINES[y], s=>s.length+1)-1;
      let linedat = [ [x1, y], [x2, y] ];
      let path = root.append('path')
        .classed('underline', true)
        .attr('stroke', color)
        .attr('stroke-width', 3)
        .attr('d', line(linedat))
        .attr('opacity', 1)
        .call(this.animatePath, duration);
    }
  }

  // Make the path grow to its full length over the given duration
  animatePath(path, duration) {
    let totalLength = path.node().getTotalLength();
    path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);
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
