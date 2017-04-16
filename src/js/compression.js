import * as d3 from 'd3';
import LINES from './lines.js';
import DITTOS from './dittos.js';
import scroll_controller from './scroll.js';
import ScrollMagic from 'scrollmagic';

const text_scale = 4/5;

const src_color = 'purple';
const dest_color = 'darkgreen';

const ravel_duration = 2000;

// When animating underlining of some text, the given duration will be
// interpreted as ms required to traverse this many pixels of text.
const text_reference_length = 200;

class CompressionGraphic {

  setScene() {
    let scene = new ScrollMagic.Scene({
        triggerElement: this.rootsel,
        triggerHook: 0,
        duration: 3200*3,
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
  }

  defrag() {
    let invis = this.svg.selectAll('.word')
      .filter(d => !d.visible);
    invis
      .attr('font-size', this.fontsize)
      .transition()
      .duration(5000)
      .attr('font-size', 0.1)
      // XXX: for some reason transitioning to 0 and/or remove()ing
      // causes a noticeable jitter at the end

    // Sweep dittos into a few lines in top-right
    let dittos_per_line = Math.floor(this.colwidth/(2*2*this.ditto_radius));
    let dittowhere = i => {
      let row = Math.floor(i/dittos_per_line);
      let col = i % dittos_per_line;
      return {x: this.W - this.ditto_radius - (col*this.ditto_radius*2),
        y: this.ditto_radius + (row*this.ditto_radius*2)
      };
    }

    this.svg.selectAll('.ditto')
      .on('mouseover', null)
      .on('mouseout', null)
      .transition()
      .duration(5000)
      .attr('cx', (d,i) => dittowhere(i).x)
      .attr('cy', (d,i) => dittowhere(i).y)
      
    this.crunch();
  }

  // Vertically compactify
  crunch() {
    let lines = this.svg.selectAll('.line')
      .filter(line => line.some(w=>w.visible));
    lines.exit().remove();
    lines
      .transition()
      .delay(5000)
      .duration(5000)
      .attr('x', (d,i) => this.linex(i))
      .attr('y', (d,i) => this.y.text(i));
  }

  constructor() {
    this.controller = scroll_controller;
    this.dittos = DITTOS;
    this.fontsize = 16 * text_scale;
    // pretty close
    this.glyphwidth = 9.6 * text_scale;
    this.lineheight = this.fontsize*1.05;
    // scaling for various pieces of the graphic 
    this.x = {
      underline: x=>this.glyphwidth * x,
      marker: x => (this.glyphwidth * x) + this.glyphwidth/2
    }
    this.y = {
      marker: y => (this.lineheight * y) - this.lineheight * .25,
      text: y=>this.basey(y),
    };
    this.rootsel = '#compression';
    this.setScene();
    this.root = d3.select(this.rootsel);
    let butcon = this.root.append('div');
    const buttons = [
      {name: 'step', cb: ()=>this.step()},
      {name: 'unstep', cb: ()=>this.unstep()},
      {name: 'reset', cb: ()=>this.reset()},
      {name: 'fast-forward', cb: ()=>this.step(null, 1000)},
      {name: 'defrag', cb: ()=>this.defrag()},
    ];
    butcon.selectAll('button').data(buttons)
      .enter()
      .append('button')
      .classed('btn', true)
      .text(d=>d.name)
      .on('click', d=>d.cb());

    let margin = {top: 20, right: 20, bottom: 50, left: 40};
    var totalW = 1200;
    var totalH = 600;
    this.W = totalW - margin.left - margin.right;
    this.H = totalH - margin.top - margin.bottom;
    this.svg = this.root.append('svg')
      .attr('width', totalW)
      .attr('height', totalH)
      .style('background-color', 'rgba(255,240,255,1)')
      .append("g")
        .attr("transform", "translate(" + margin.left + " " + margin.top + ")");
    
    this.ncols = 3;
    this.maxlines = 44;
    this.colwidth = this.W/this.ncols;
    this.ditto_radius = this.fontsize/4;
    
    this.lastditto = -1;
    this.renderText();
  }

  reset() {
    this.svg.text('');
    this.renderText();
  }

  basey(y) {
    y = y % this.maxlines;
    return this.lineheight * y;
  }
  linex(y) {
    let col = Math.floor(y/this.maxlines);
    return (col*this.colwidth);
  }
  getcol(y) {
    return Math.floor(y/this.maxlines);
  }

  renderText() {
    let linedat = [];
    let y = 0;
    for (let line of LINES) {
      line = line.map((word,i)=> ({word:word, x:i, y:y, visible:true}));
      y += 1;
      linedat.push(line);
    }
    this.linedat = linedat;
    let lines = this.svg.selectAll('.line').data(linedat);
    let newlines = lines.enter()
      .append('text')
      .classed('line', true)
      .attr('font-size', this.fontsize)
      .attr('font-family', 'courier,monospace')
      .attr('alignment-baseline', 'middle') // seems not to do anything?
      .attr('x', (d,i) => this.linex(i))
      .attr('y', (d,i) => this.y.text(i));
    let words  = lines.merge(newlines)
      .selectAll('.word')
      .data(words=>words);
    let newwords = words.enter()
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
    dittos.enter().each( (d,i,n) => this.ravel(d, ravel_duration) );
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
    dittos.enter().each( (d,i,n) => this.ravel(d, ravel_duration) );
    dittos.exit()
      .each( (d,i,n) => this.unravel(d,n[i]) )
      .remove();
  }

  unravel(d) {
    let dest = this.selectRange(d.dest);
    // cancel any ongoing transitions
    dest.interrupt();
    // Unhide the corresponding dest text
    dest
      .transition()
      .duration(ravel_duration/4)
      .attr('opacity', 1);
  }
  
  ravel(d, duration) {
    var dur, delay, root, wait;
    const steps = [
      {dur: 1, desc: 'underline dest', 
        fn: () => {
          //console.log(`step 1. wait=${wait}, dur=${dur}`);
          return this.addTextLine(d.dest, dest_color, dur, root, wait);
        }
      },
      {dur: 2, desc: 'arrow',
        fn: () => {
          this.animateArrow(d, root, dur, wait, 'src');
        }
      },
      {dur: .66, desc: 'underline src',
        fn: () => {
          return this.addTextLine(d.src, src_color, dur, root, wait);
        }
      },
      {dur: 1, desc: 'erase dest',
        fn: () => {
          let dest = this.selectRange(d.dest);
          // XXX hack
          dest.each(d=> {
            this.linedat[d.y][d.x].visible = false;
          });
          let erase = dest
            .attr('opacity', 1)
            // TODO: is this redundant now?
            //.datum(d=>({...d, visible:false}) )
            .transition()
            .delay(wait)
            .duration(dur)
            .ease(d3.easeLinear)
            .attr('opacity', .1);
          let where = this.locate(this.rangeCentroid(d.dest));
          let marker = root.append('circle')
            .classed('ditto wordlike', true)
            .datum(d)
            .attr('cx', where.x)
            .attr('cy', where.y)
            // TODO: maybe radius should scale with the size of the ditto?
            .attr('r', this.ditto_radius)
            .attr('opacity', .4);
          /*
            .on('mouseover', (d,i,n)=>this.onMarkerHover(d,n[i]))
            .on('mouseout', ()=>this.clearHover())
            .attr('fill', src_color);
            */
        }
      },
      {dur: .3, desc: 'erase underlines/arrow',
        fn: () => {
          for (let sel of ['.underline', '.arrow']) {
            root.selectAll(sel)
              .transition()
              .delay(wait)
              .duration(dur)
              .ease(d3.easeLinear)
              .attr('opacity', 0)
              .remove();
          }
        }
      },
    ];
    let clock = 0;
    let total_durs = d3.sum(steps, s=>s.dur);
    let durscale = dur => dur * (duration/total_durs);
    root = this.svg
      .append('g')
      .classed('dittocontainer', true);
    for (let step of steps) {
      dur = durscale(step.dur);
      wait = clock;
      let res = step.fn();
      // Step functions may optionally return a duration, if they need 
      // flexibility in taking more or less time than the suggested
      // duration.
      if (res) {
        clock += res;
      } else {
        clock += dur;
      }
    }
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
    // Un-hide any invisible text in the source text
    srctext
      .transition()
      .duration(dur)
      .ease(d3.easeLinear)
      .attr('stroke', 'orange')
      .attr('opacity', .6);

    // Draw an arrow from src to dest
    let arrowdur = 1000;
    this.animateArrow(d, hoverbox, arrowdur);

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

  animateArrow(d, root, duration, delay, to='dest') {
    // TODO: give this arrow a pointy end
    // TODO: should start from underline position, not where a marker would be
    let start = this.locate(this.rangeCentroid(d.src));
    let end = this.locate(this.rangeCentroid(d.dest));
    if (to === 'src') {
      [start, end] = [end, start];
    }
    let pts = [start, this.getInflection(start, end), end];
    let line = d3.line()
      .curve(d3.curveNatural) // chosen arbitrarily
      .x(d=>d.x)
      .y(d=>d.y);
    let path = root.append('path')
      .classed('arrow', true)
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('fill', 'none')
      .attr('opacity', 1)
      .attr('d', line(pts));
    return this.animatePath(path, duration, delay);
  }

  getInflection(start, end) {
    let x,y;
    const tooclose = 40;
    let xmean = (start.x+end.x)/2;
    let xspan = Math.abs(start.x-end.x);
    let ymean = (start.y+end.y)/2;
    let yspan = Math.abs(start.y-end.y);
    let swoopscale = .3;
    if (xspan <= tooclose) {
      // If too close x-wise, swoop to the side.
      let sgn = (start.x < this.colwidth) ? 1 : -1;
      x = xmean + Math.max(30, yspan * swoopscale) * sgn;
      y = ymean;
    } else { // otherwise, swoop down (or up)
      let maxy = Math.max(start.y, end.y);
      let sgn = maxy >= this.H*.8 ? -1 : 1;
      y = ymean + Math.max(30, xspan * swoopscale) * sgn;
      x = xmean;
    }
    return {x,y};
  }

  // Return the length of the given line in characters.
  linewidth(y) {
    return d3.sum(LINES[y], s=>s.length) 
      + (LINES[y].length-1) // account for spaces between words
  }

  locate(where) {
    let col = this.getcol(where.y);
    return {x: this.glyphwidth*where.x+(col*this.colwidth),
      y: this.lineheight*(where.y%this.maxlines)
    };
  }

  // Return centroid of given range of text, in natural units
  // TODO: any good reason to output natural units rather than px?
  // I guess differing scales?
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
    return {x, y};
  }

  clearHighlights(delay) {
    this.svg.selectAll('.underline').remove();
  }

  highlightSrc(range, duration, root, transition_name=null) {
    return this.addTextLine(range, src_color, duration, root, transition_name);
  }
  highlightDest(range, duration, root, transition_name=null) {
    return this.addTextLine(range, dest_color, duration, root, transition_name);
  }

  // Add underline to a given range of text (using paths, not text-decoration)
  addTextLine(range, color, ref_duration, root, delay) {
    if (!root) {
      root = this.svg;
    }
    let yrange = d3.range(range.y1, range.y2+1);
    // For each y, need two x-coords: start and end
    let xpairs = y => {
      let x1 = y === range.y1 ? range.x1 : 0;
      let x2 = y === range.y2 ? range.x2 : d3.sum(LINES[y], s=>s.length+1)-1;
      return [x1, x2];
    };
    let get_linedat = y => {
      let [x1, x2] = xpairs(y);
      return [ [x1, y], [x2, y] ];
    };
    let line = d3.line()
      .x( ([x,y]) => this.linex(y) + this.x.underline(x) )
      .y( ([x,y]) => this.y.text(y) );
    let paths = root.selectAll().data(yrange)
      .enter()
      .append('path')
      .classed('underline', true)
      .attr('stroke', color)
      .attr('stroke-width', 3)
      .attr('d', y => line(get_linedat(y)))
      .attr('opacity', .4);
    // px/ms
    let velocity = text_reference_length / ref_duration;
    let actual_dur = 0;
    paths.each( (d,i,n) => {
      let node = n[i];
      let len = node.getTotalLength();
      let dur = len / velocity;
      this.animatePath(d3.select(node), dur, delay+actual_dur);
      actual_dur += dur;
    });
    return actual_dur;
  }

  _animatePath(pathsel, dur, delay) {
    let getLen = (d,i,nodes) => nodes[i].getTotalLength();
    return pathsel
      .attr("stroke-dasharray", (d,i,n) => {
        let l = getLen(d,i,n);
        return l + " " + l;
      })
      .attr("stroke-dashoffset", getLen)
      .transition()
        .delay(delay)
        .duration(dur)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);
  }

  // Make the path grow to its full length over the given duration
  animatePath(path, duration, delay) {
    let totalLength = path.node().getTotalLength();
    return path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
        .delay(delay)
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
