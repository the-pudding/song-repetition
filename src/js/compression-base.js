import * as d3 from 'd3';
import SLUGS from './lz-directory.js';
import { BaseChart } from './basechart.js';

const text_scale = 4/5;

const src_color = 'purple';
const dest_color = 'darkgreen';

const ravel_duration = 2000;

// When animating underlining of some text, the given duration will be
// interpreted as ms required to traverse this many pixels of text.
const text_reference_length = 200;

const STATE = {
  loading: 'loading',
  ready: 'ready',
  running: 'running',
  paused: 'paused',
  defragged: 'defragged',
}

class BaseCompressionGraphic extends BaseChart {

  constructor(rootsel, config={}) {
    // TODO: define as a sort of state machine? (Cause there are sort of certain
    // rules that apply when going between certain pairs of states.)
    super(rootsel, {...config, responsive: true});
    this.rootsel = rootsel;
    this.speed = 1.0;
    this.state = STATE.loading;
    this.ravel_duration = 2000;
    this.defrag_duration = 5000;
    this.json_cache = new Map();
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
    if (config.debug) {
      let butcon = this.root.insert('div', ':first-child');
      const buttons = [
        {name: 'step', cb: ()=>this.step()},
        //{name: 'reset', cb: ()=>this.reset()},
        {name: 'fast-forward', cb: ()=>this.setLastDitto(10000)},
        {name: 'defrag', cb: ()=>this.defrag()},
        {name: 'shuffle', cb: ()=>this.shuffle()},
        {name: 'debug', cb: ()=>this.thing()},
      ];
      butcon.selectAll('button').data(buttons)
        .enter()
        .append('button')
        .classed('btn', true)
        .text(d=>d.name)
        .on('click', d=>d.cb());
    }
    this.ncols = config.ncols || 3;
    this.maxlines = 44;
    this.colwidth = this.W/this.ncols;
    this.ditto_radius = this.fontsize/4;

    // Arrow head defn. Based on http://bl.ocks.org/mbostock/1153292
    this.root.select('svg')
      .append('defs')
        .append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 15)
        .attr('refY', -1.5)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
          .attr('d', 'M0,-5L10,0L0,5');

    this.lastditto = -1;
    this.ready_queue = [];
    this.setSong(config.song || 'cheapthrills_chorus');
  }

  thing() {
    let x = 12;
    let y = this.ncols;
    debugger;
    let z = 1;
  }

  shuffle() {
    let i = Math.floor(Math.random() * SLUGS.length);
    this.reset(SLUGS[i]);
  }

  reset(slug, smooth=false) {
    this.state = STATE.loading;
    this.defragged = false;
    // TODO: all these different booleans are messy and brittle. Should just
    // have one 'state' enum variable.
    this.running = false;
    this.lastditto = -1;
    this.shutdowneverything();
    if (!smooth) {
      this.svg.text('');
      this.setSong(slug || this.slug);
    } else {
      let dur = 1000;
      this.wipeIn(dur)
        .on('end', () => {
          this.svg.text('');
          this.setSong(slug || this.slug);
          this.wipeOut(dur);
        });
      return dur*2;
    }
  }

  shutdowneverything() {
    this.svg.selectAll('*').interrupt();
  }

  wipeIn(dur) {
    let mask = this.root.select('svg')
      .append('rect')
      .classed('mask', true)
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.totalW)
      .attr('height', this.totalH)
      .attr('fill', 'white')
      .attr('opacity', 0);
    return mask
      .transition()
      .duration(dur)
      .attr('opacity', 1);
  }
  // ha ha ha ha ha
  wipeOut(dur) {
    this.root.selectAll('.mask')
      .transition()
      .duration(dur)
      .attr('opacity', 0)
      .remove();
  }

  play(speed=1.0, accel=null) {
    if (!(this.state === STATE.ready || this.state === STATE.paused)) {
      console.log(`Can't play in state ${this.state}`);
    } else {
      this.state = STATE.running;
      this._playloop(speed, accel);
    }
  }
  pause() {
    this.state = STATE.paused;
  }
  _playloop(speed, accel, iter=0) {
    if (this.state != STATE.running) return;
    let dur = this.ravel_duration/this.speed;
    if (accel) {
      dur = accel(iter, dur);
    }
    let step = this.step(dur);
    if (!step) {
      // TODO: not clear if this should happen here or in step()
      this.defrag(this.defrag_duration/this.speed);
    } else {
      step.then(()=> this._playloop(speed, accel, iter+1));
    }
  }

  defrag() {
    if (this.state === STATE.loading || this.state === STATE.defragged) {
      console.log(`Can't defrag in state ${this.state}`);
      return;
    }
    this.state = STATE.defragged;
    let clock = 0;
    let dur;
    const time_pie = {
      erase: .2,
      dittosweep: .2, // concurrent with above?
      crunch: .2,
      banner: .3,
      odom: .1,
    }
    Object.keys(time_pie).map(k => {
      time_pie[k] = time_pie[k] * this.defrag_duration;
    });
    // TODO: cancel any ongoing ditto transitions, clear any underlines/arrows
    let invis = this.svg.selectAll('.word')
      .filter(d => !d.visible);
    dur = time_pie.erase;
    invis
      .attr('font-size', this.fontsize)
      .transition()
      .duration(dur)
      .attr('font-size', 0.1)
      // XXX: for some reason transitioning to 0 and/or remove()ing
      // causes a noticeable jitter at the end
    clock += dur;

    // Sweep dittos into a few lines in top-right
    let dittos_per_line = Math.floor(this.colwidth/(2*2*this.ditto_radius));
    let odom_bbox = this.odometer.node().getBBox();
    let dittowhere = i => {
      let row = Math.floor(i/dittos_per_line);
      let col = i % dittos_per_line;
      return {x: this.W - this.ditto_radius - (col*this.ditto_radius*2),
        y: odom_bbox.height + this.ditto_radius + (row*this.ditto_radius*2)
      };
    }

    dur = time_pie.dittosweep;
    this.svg.selectAll('.ditto')
      .on('mouseover', null)
      .on('mouseout', null)
      .transition()
      .duration(dur)
      .attr('cx', (d,i) => dittowhere(i).x)
      .attr('cy', (d,i) => dittowhere(i).y)
      
    dur = time_pie.crunch;
    this.crunch(dur, clock);
    clock += dur;

    // show size reduction info
    let [bannerx, bannery] = [this.W/3, this.H/3];
    let banner = this.svg
      .append('g')
      .attr('transform', `translate(${bannerx}, ${bannery})`)
      .attr('opacity', 0);
    let line = banner
      .append('text')
      .text(`Original size: ${this.totalchars} characters`);
    let lineheight = this.lineheight*2;
    let stats = this.compressionStats();
    let compchars = this.totalchars - stats.chars_saved;
    let compline = `Compressed size: ${compchars} characters/bytes`;
    compline += ` + ${stats.ndittos} dittos`;
    compline += ` = ${compchars+stats.ndittos*3} bytes`;
    banner
      .append('text')
      .attr('dy', lineheight)
      .text(compline);
    
    dur = time_pie.banner;
    let banner_trans = banner
      .transition()
      .delay(clock)
      .duration(dur)
      .attr('opacity', 1)
    clock += dur;
    // translate and scale odometer
    dur = time_pie.odom;
    this.odometer
      .transition()
      .delay(clock)
      .duration(dur)
      .attr('transform', `translate(${bannerx}, ${bannery+lineheight*2.5})`)
      .attr('font-size', 24);

    let butt = banner.append('text')
      .text('Start Again?')
      .on('click', ()=>this.startagain())
      .attr('dy', lineheight*5)
      .style('cursor', 'pointer')
      .attr('fill', 'blue');

  }

  startagain() {
    this.reset();
  }

  // Vertically compactify
  crunch(dur, wait) {
    let lines = this.svg.selectAll('.line')
      .filter(line => line.some(w=>w.visible));
    lines.exit().remove();
    lines
      .transition()
      .delay(wait)
      .duration(dur)
      .attr('x', (d,i) => this.linex(i))
      .attr('y', (d,i) => this.y.text(i));
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

  setSong(slug) {
    this.slug = slug;
    this.state = STATE.loading;
    let songdat_callback = songdat => {
      let lines = songdat.lines;
      this.dittos = songdat.dittos;
      this.totalchars = d3.sum(lines, 
          l => Math.max(0, d3.sum(l, w=>w.length))
      );
      this.renderText(lines);
      this.renderOdometer();
      this.state = STATE.ready;
      this.ready_queue.forEach(cb => cb());
      this.ready_queue = [];
    }
    let cached = this.json_cache.get(slug);
    if (cached) {
      console.log('Cache hit');
      songdat_callback(cached);
    } else {
      let url = 'assets/lz/' + slug + '.json';
      d3.json(url, songdat_callback);
    }
  }

  warmCache(slugs) {
    for (let slug of slugs) {
      let url = 'assets/lz/' + slug + '.json';
      d3.json(url, songdat => this.json_cache.set(slug, songdat));
    }
  }
  get ready() {
    return this.state !== STATE.loading;
  }
  onReady(cb) {
    if (this.ready) {
      cb();
    } else {
      this.ready_queue.push(cb);
    }
  }

  renderText(raw_lines) {
    let linedat = [];
    let y = 0;
    for (let line of raw_lines) {
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
    let words = lines.merge(newlines)
      .selectAll('.word')
      .data(_words=>_words);
    let newwords = words.enter()
      .append('tspan')
      .classed('word', true)
      .text(w=>w.word);
  }

  renderOdometer() {
    let where = this.odometerWhere();
    this.odometer = this.svg.append('g')
      .classed('odometer', true)
      .attr('font-size', 18)
      .attr('transform', `translate(${where.x}, ${where.y})`);
    this.odometer
      .append('text')
      .classed('reduction', true)
      .attr('text-anchor', 'end')
      .text('Size reduction: 0%');
    return;
    let lineno = 0;
    for (let classname of ['orig', 'comp', 'reduction']) {
      this.odometer
        .append('text')
        .attr('dy', this.lineheight*lineno++)
        .classed(classname, true);
    }
    this.odometer.select('.orig')
      .text(`Original size: ${this.totalchars} characters`);
  }
  odometerWhere() {
    //let x = (.5 + this.ncols-1)*this.colwidth
    //let y = this.lineheight;
    let x = this.W;
    let y = 0;
    return {x,y};
  }

  compressionStats() {
    let ndittos = this.lastditto+1;
    // TODO: XXX: store ditto size in chars
    // Orrrr... could just select visible tspans and look at their words.
    let chars_saved = d3.sum(this.svg.selectAll('.word')
      .filter(d=>!d.visible)
      .data(), d=> d.word.length);
    return {ndittos: ndittos, chars_saved: chars_saved,
      reduction: ((chars_saved-(ndittos*3))/this.totalchars),
    };
  }

  updateOdometer() {
    // XXX: May want to be a bit more efficient, keeping a running
    // total rather than recalculating the whole thing each time.
    let stats = this.compressionStats();
    let reduc_pct = d3.format('.1%')(stats.reduction);
    // TODO: colormap?
    this.odometer.select('.reduction')
      .text(`Size reduction: ${reduc_pct}`);
  }

  get activeDittos() {
    return this.dittos.filter(d=>d.active);
  }

  step(dur) {
    if (dur === undefined) {
      dur = this.ravel_duration;
    }
    let nexti = this.lastditto+1;
    nexti = Math.min(this.dittos.length-1, nexti);
    if (nexti === this.lastditto) {
      console.log("can't step");
      return;
    }
    this.lastditto = nexti;
    let ditto = this.dittos[nexti];
    ditto.active = true;
    let wait = this.ravel(ditto, dur);
    this.updateOdometer();
    return new Promise( (resolve,reject) => {
      // imperfect sol'n (compared to actually chaining transitions), but 
      // should be good enough
      d3.timeout(resolve, wait);
    });
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
    this.updateOdometer();
  }

  eraseDitto(d, dur, wait=0, root=null) {
    if (!root) {
      root = this.svg;
    }
    let dest = this.selectRange(d.dest);
    dest.each(d=> {
      this.linedat[d.y][d.x].visible = false;
      d.visible = false;
    });
    let n = dest.size();
    let expected_nodes = d.dest.nwords;
    console.assert(expected_nodes === n,
        `Got ${n} nodes, expected ${expected_nodes}`);
    let erase = dest
      .attr('opacity', 1)
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
      .attr('opacity', .4)
      .on('mouseover', (d,i,n)=>this.onMarkerHover(d,n[i]))
      .on('mouseout', ()=>this.clearHover())
      .attr('fill', src_color);
  }

  unravel(d) {
    // TODO: Keep data consistent (visibility attr)
    // Those changes should probably be happening further
    // upstream.
    let dest = this.selectRange(d.dest);
    dest.each(d=> {
      this.linedat[d.y][d.x].visible = true;
    });
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
      {dur: .5, desc: 'underline src',
        fn: () => {
          return this.addTextLine(d.src, src_color, dur, root, wait);
        }
      },
      {dur: 1, desc: 'erase dest',
        fn: () => this.eraseDitto(d, dur, wait, root)
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
    return clock;
  }

  onMarkerHover(d, node) {
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
      //.attr('stroke', 'orange')
      .attr('opacity', .6);

    // Draw an arrow from src to dest
    let arrowdur = 1000;
    this.animateArrow(d, hoverbox, arrowdur);

    let desttext = this.selectRange(d.dest);
    this.marked.push(desttext);
    this.highlightDest(d.dest, dur, hoverbox, dur+arrowdur);
    desttext
      .transition()
      .delay(dur+arrowdur)
      .duration(dur*2)
      .ease(d3.easeLinear)
      //.attr('stroke', 'orange')
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

  animateArrow(d, root, duration, delay=0, to='dest') {
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
      .style('pointer-events', 'none')
      .attr('d', line(pts));
    return this.animatePath(path, duration, delay, 1);
  }

  getInflection(start, end) {
    // TODO: should choose swoop direction based on which dimension
    // has greater delta
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

  // Return the length of the given line of text in characters.
  linewidth(y) {
    return d3.sum(this.linedat[y], w=>w.word.length);
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
  clearArrows() {
    this.svg.selectAll('.arrow').remove();
  }
  clearMarkers() {
    this.svg.selectAll('.word')
      .attr('opacity', 1)
      .datum(d => ({...d, visible: true}));
    this.svg.selectAll('.marker').remove();
  }

  highlightSrc(range, duration, root, delay=0) {
    return this.addTextLine(range, src_color, duration, root, delay);
  }
  highlightDest(range, duration, root, delay=0) {
    return this.addTextLine(range, dest_color, duration, root, delay);
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
      let x2 = y === range.y2 ? range.x2 : this.linewidth(y);
      // I have measured out my life in off-by-one errors.
      return [x1, x2+1];
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
  animatePath(path, duration, delay, arrow=false) {
    let totalLength = path.node().getTotalLength();
    let trans = path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
        .delay(delay)
        .duration(duration)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);
    if (arrow) {
      trans
        .transition()
        .attr('marker-end', 'url(#arrow)');
    }
    return trans;
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
}

export { BaseCompressionGraphic, STATE };
