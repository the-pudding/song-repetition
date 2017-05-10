import * as d3 from 'd3';
import scroll_controller from './scroll.js';
import ScrollMagic from 'scrollmagic';
import 'scrollmagic/scrollmagic/uncompressed/plugins/debug.addIndicators.js'
import { BaseCompressionGraphic, STATE } from './compression-base.js';
import { isMobile } from './helpers.js';

// TODO: maybe show extended odometer?

const play_accel = (iter, dur) => {
  return Math.max(100, dur * Math.pow(0.9, iter));
};
const play_speed = 4;
const autoplay = 0;
// 1: no acceleration. >1: positive acceleration.
const scroll_acceleration = 1;

// verbose debug logging
const verbose = false;
const vblog = s => {
  if (verbose) {
    console.log(s);
  }
}

// Standard padding for slide-wrapper elements. This affects the distance
// between slide paragraphs (obviously). It's especially important for
// 'progressive' stages (i.e. ones that tie scroll progress to the corresponding
// animation) because it determines the duration of their scene, and therefore
// the rate of animation progress per pixel scrolled.
// Measured in rems.
// TODO: I'm not even entirely sure padding is the right attr to be using
// here (rather than margin/border). I always forget the difference, and
// how the collapsing stuff works.
const std_padding = isMobile() ?
  {top: 0, bottom: 16}
  :
  {top: 0, bottom: 10};

// TODO: would be cool to bind *all* the stages to scroll progress

class CompressionWrapper {
  constructor() {
    this.controller = scroll_controller;
    this.stage_data = this.get_stage_data();
    let rootsel = '#compression-mini';
    this.rootsel = rootsel;
    this.root = d3.select(rootsel);
    let comp_config = {
      W: 800, ncols: 1, H: 500,
      song: 'cheapthrills_chorus',
    };
    this.comp = new CompressionTutorial('#compression-mini .graphic-vis',
        comp_config);
    this.prose = this.root.select('.graphic-prose');
    this.vis = this.root.select('.graphic-vis');
    this.setupProse();
    this.comp.onReady( () => this.setScene() );
  }

  setupProse() {
    let proses = this.prose.selectAll('.slide-wrapper').data(this.stage_data)
      .enter()
      .append('div')
      .classed('slide-wrapper', true)
      .classed('first', (d,i) => i===0)
      .classed('progressive', d => d.progressive)
    proses
      .append('div')
      .classed('slide', true)
      .html(sd => sd.html)
      .classed('hidden', sd => !sd.html)
    proses.filter(sd => sd.padding)
      .style('padding-top', 
          sd=> (
            (sd.paddingMobile && isMobile()) ? 
              sd.paddingMobile.top
              :
              sd.padding.top
            ) + 'rem'
      )
      .style('padding-bottom', 
          sd=> (
            (sd.paddingMobile && isMobile()) ? 
              sd.paddingMobile.bottom
              :
              sd.padding.bottom
            ) + 'rem'
      )
  }

  // Setup the overall scene wherein the compression graphic is pinned to
  // the top, and the sub-scenes for each stage of the graphic.
  setScene() {
    let viewportHeight = window.innerHeight;
    // TODO: use setpin instead?
    let outerscene = new ScrollMagic.Scene({
      triggerElement: this.rootsel,
      triggerHook: 'onLeave',
      duration: Math.max(1, this.root.node().offsetHeight - viewportHeight),
    })
      .on('enter', () => this.toggleFixed(true, false))
      .on('leave', e => this.toggleFixed(false, e.scrollDirection === 'FORWARD'))
      //.addIndicators()
      .addTo(this.controller);

    let slides = this.prose.selectAll('.slide-wrapper');
    slides.each( (dat,i,n) => {
      let wrappernode = n[i];
      let stagenode = d3.select(wrappernode).select('.slide');
      let stageheight = stagenode.node().offsetHeight;
      // we carefully set the duration so that the scenes tile exactly, with 
      // no gaps or overlaps.
      let duration = wrappernode.offsetHeight - stageheight;
      if (i === n.length-1) {
        duration += 500; // XXX hack
      } else {
        let nextstage = d3.select(n[i+1]).select('.slide').node();
        duration += nextstage.offsetHeight;
      }
      let slide_scene = new ScrollMagic.Scene({
        triggerElement: wrappernode,
        triggerHook: 'onEnter',
        offset: stageheight,
        duration: duration,
      })
        //.addIndicators({name: 'inner'+i})
        .on('enter', (e) => {
          let slug = dat.slug;
          console.assert(slug, "No slug set for this stage");
          let cb = dat.onEnter ?
            () => dat.onEnter(this.comp, e.scrollDirection === 'FORWARD')
          : () => null;
          if (this.comp.slug != slug) {
            vblog(`Quickchanging. Slide slug = ${slug}, current graphic slug = ${this.comp.slug}`);
            this.comp.quickChange(slug).then(cb);
          } else {
            if (this.comp.state === STATE.defragged && !dat.allow_defragged) {
              vblog('Refragging');
              this.comp.refrag();
            }
            cb();
          }
          vblog(`Entered stage ${i} w direction ${e.scrollDirection}`);
          stagenode.classed('active', true);
          if (dat.progressive) {
            this.comp.acquireScrollLock(i);
          }
          if (dat.proxy) {
            let proxynode = n[i+dat.proxy];
            d3.select(proxynode).select('.slide')
              .classed('active', true);
          }
        })
        // NB: when duration is not set, leave event is fired when the
        // trigger is scrolled past from the opposite scroll direction
        // TODO: this shouldn't be necessary
        .on('leave', (e) => {
          vblog(`Left stage ${i}`);
          stagenode.classed('active', false);
          let exitkey = e.scrollDirection === 'FORWARD' ? 'down' : 'up';
          let exitfn = dat.onExit && dat.onExit[exitkey];
          if (exitfn) {
            exitfn(this.comp);
          }
          if (dat.progressive) {
            this.comp.releaseScrollLock(i);
          }
          if (dat.proxy) {
            let proxynode = n[i+dat.proxy];
            d3.select(proxynode).select('.slide')
              .classed('active', false);
          }
        })
        .addTo(this.controller);
        if (!autoplay && dat.progressive) {
          slide_scene.on('progress', e => {
            this.comp.onScroll(e.progress, i, dat);
          });
        }
    });
  }
  toggleFixed(fixed, bottom) {
    this.vis.classed('is-fixed', fixed);
    this.vis.classed('is-bottom', bottom);
  }
  static init() {
    new CompressionWrapper();
  }


  /////////////////////////////// STAGE DATA //////////////////////////////////

  get_stage_data() {
    return [
  {
    slug: 'cheapthrills_chorus',
    allow_defragged: false,
    html: `<p>The Lempel-Ziv algorithm scans the input from beginning to end looking for chunks of text that exactly match earlier parts</p>`,
    onEnter: (comp, down) => {
      comp.setLastDitto(-1);
      comp.clearStagebox();
    }
  },
  {
    slug: 'cheapthrills_chorus',
    allow_defragged: false,
    html: `<p>The <code>ills</code> in "thrills" is our first non-trivial repetition.</p>`,
    onEnter: (comp, down) => {
      comp.clearStagebox();
      comp.setLastDitto(-1);
      let ditto = comp.dittos[0];
      let highlight_dur = 2500;
      comp.highlightSrc(ditto.src, highlight_dur);
      comp.highlightDest(ditto.dest, highlight_dur);
    },
    onExit: {
      up: (comp) => {
        comp.clearHighlights();
        comp.clearArrows();
      }
    },
  },

  {
    slug: 'cheapthrills_chorus',
    allow_defragged: false,
    html: `<p>We replace it with a marker pointing back to the occurrence on the first line, in "bills".</p>
    <p class="sidenote"><small>The marker itself takes some space to store (we need to remember how long the match is, and how far back it occurs) - we'll say it's the equivalent of 3 characters. That's why it wasn't worth it to replace any of the smaller repeated substrings that occur earlier like <code>I </code>&nbsp; or &nbsp;<code> to</code>.</small></p>`,
    onEnter: (comp, down) => {
      let dur = 1000;
      let ditto = comp.dittos[0];
      if (!down) {
        // TODO: make sure highlight is there :/
        comp.setLastDitto(0);
        comp.animateArrow(ditto, comp.stagebox, dur, 0);
      } else {
        comp.animateArrow(ditto, comp.stagebox, dur, 0);
        // this method name is misleading...
        comp.eraseDitto(ditto, dur, dur);
        // TODO: want to avoid setting this directly where possible
        comp.lastditto = 0;
        comp.updateOdometer();
      }
    },
  },

  {
    // TODO: seems kind of fragile/confusing to split the work of defining
    // padding on these things between js and css. Should probably stick to
    // just one.
    padding: {top: std_padding.top, bottom: 12},
    progressive: false,
    slug: 'cheapthrills_chorus',
    allow_defragged: false,
    html: `<p>The third and fourth lines are exact duplicates of the first two, so we can replace them with a single marker. At this point, we've already reduced the size of the chorus by 29%.</p>`,
    onEnter: (comp, down) => {
      comp.clearStagebox();
      comp.clearHighlights();
      comp.clearArrows();
      comp.setLastDitto(1, {ravel_duration: 2500});
      // TODO: draw attention to odometer
    },
    onExit: {
      up: comp => comp.unravel(comp.dittos[1]),
    },
  },

  {
    progressive: true,
    proxy: -1,
    ditto_offset: 2,
    slug: 'cheapthrills_chorus',
    allow_defragged: false,
    html: '',
    onEnter: (comp, down) => {
    },
  },

  {
    padding: {top: std_padding.top, bottom: std_padding.bottom * 2/3},
    paddingMobile: {top: std_padding.top, bottom: std_padding.bottom},
    slug: 'cheapthrills_chorus',
    allow_defragged: true,
    html: `<p>In the end, the chorus is reduced in size 46%, from 247 characters to 133 (counting each marker as the equivalent of 3 characters).
      </p>
      `,
/*
<p><small>
The choice of 3 characters as the cost of a marker is somewhat arbitrary. We could slide this up to a high value like 20 if we only care about larger-scale repetition. The only opportunities for compression in that case would be repeated sequences of 20 or more characters - i.e. multi-word phrases, not just repetitions of single words or parts of words.
</small></p>
      `,
*/
    onEnter: (comp, down) => {
      if (comp.state !== STATE.defragged) {
        comp.fastforward();
        comp.defrag();
      }
    },
  },

  {
    padding: {top: std_padding.top, bottom: std_padding.bottom*4.5},
    progressive: true,
    allow_defragged: false,
    slug: 'thrillscheap',
    html: `<p>How does that compare to my jumbled version of the same words?</p>`,
    onEnter: (comp) => {
      // TODO: if doing the progressive thing, need to make sure the
      // progress() calls wait for load
      if (autoplay) {
        // TODO: Maybe just use setLastDitto rather than play?
        comp.speed = play_speed;
        comp.play(play_speed, play_accel) ;
      }
    },
  },

  {
    padding: {top: std_padding.top, bottom: std_padding.bottom * 2/3},
    progressive: false,
    allow_defragged: true,
    slug: 'thrillscheap',
    html: `<p>The jumbled version shrinks less than the original (29.5% vs. 46%). This is good! It agrees with intuition.</p>`,
    onEnter: (comp, down) => {
      if (comp.state !== STATE.defragged) {
        comp.fastforward();
        comp.defrag();
      }
    }
  },

  {
    padding: {top: std_padding.top, bottom: std_padding.bottom*2.5},
    progressive: true,
    allow_defragged: false,
    slug: 'essay_intro',
    html: `<p>What about the first paragraph of this post?</p>`,
    onEnter: (comp) => {
      if (autoplay) {
        comp.speed = play_speed;
        comp.play(play_speed, play_accel);
      }
    },
  },

  {
    padding: {top: std_padding.top, bottom: 0},
    allow_defragged: true,
    slug: 'essay_intro',
    html: `<p>A mere 8% reduction. Random prose doesn't compress nearly as well as song lyrics.</p>`,
    onEnter: (comp, down) => {
      if (comp.state !== STATE.defragged) {
        comp.fastforward();
        let cfg = {bannery: comp.H*2/3};
        comp.defrag(cfg);
      }
    }
  },

  ]
  }
}

// Maybe not even necessary?
class CompressionTutorial extends BaseCompressionGraphic {

  constructor(rootsel, config={}) {
    super(rootsel, config);
    this.restartable = false;
    // Add a container that the stage transitions can use as a sort of
    // dedicated scratch space.
    // TODO: I think this does more harm than good at this point.
    this.stagebox = this.svg.append('g')
      .classed('stage-sandbox', true);
    // TODO: technically an extra request here
    this.warmCache(['thrillscheap', 'essay_intro', 'cheapthrills_chorus']);
    this.ravel_duration = 2000;
    this.defrag_duration = 3000;
    // TODO: should this be reset on reset()
    this.scroll_owner = null;
  }

  renderOdometer() {
    let extant = this.svg.select('.odometer');
    console.assert(extant.empty());
    this.odometer_offset = this.H * .8;
    this.odometer = this.svg.append('g')
      .classed('odometer', true)
      .attr('transform', `translate(0, ${this.odometer_offset})`);

    this.odometer.append('line')
      .attr('x1', 0)
      .attr('x2', this.W)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke-width', 1)
      .attr('stroke', '#ccc')
      .attr('stroke-dasharray', 4)

    let texty = 40;
    this.odometer.append('text')
      .classed('reduction', true)
      .attr('x', this.W * .05)
      .attr('y', texty);

    if (isMobile()) {
      // Don't bother rendering the extra stats on mobile. Horizontal space is scarce,
      // and it's not essential.
      return;
    }
    let sizex = this.W * .3;
    this.odometer.append('text')
      .classed('size size-original', true)
      .attr('x', sizex)
      .attr('y', texty)
      .text(`Original size: ${this.totalchars} bytes/characters`);

    this.odometer.append('text')
      .classed('size size-compressed', true)
      .attr('x', sizex)
      .attr('y', (this.H-this.odometer_offset) * .75);
  }

  updateOdometer() {
    let stats = this.compressionStats();
    let reduc_pct = d3.format('.1%')(stats.reduction);
    this.odometer.select('.reduction')
      .text(reduc_pct + ' Size Reduction');
    
    if (isMobile()) {
      // Don't bother rendering the extra stats on mobile. Horizontal space is scarce,
      // and it's not essential.
      return;
    }

    let compsize = this.odometer.select('.size-compressed');
    let cstext = `Compressed size: ${stats.compressed_bytes} bytes`;
    cstext += ` (${stats.uncompressed_chars} characters + `;
    // Make a little space to draw a marker representation in
    let markernest = Array(5).join("\u00A0");
    cstext += `${stats.ndittos} \u00D7 ${markernest})`;
    compsize.text(cstext);
    let bb = compsize.node().getBBox();
    let rad = this.ditto_radius * 1.5;
    let src_color = '#2196f3';
    let dittorepr = this.odometer.select('circle');
    if (dittorepr.empty()) {
      dittorepr = this.odometer.append('circle')
      .attr('r', rad-1)
      .attr('opacity', .8)
      .attr('fill', src_color)
      ;
    }
    dittorepr
      .attr('cx', bb.x+bb.width-15)
      .attr('cy', bb.y+bb.height/2);
  }

  postReset() {
    this.stagebox = this.svg.append('g')
      .classed('stage-sandbox', true);
  }

  clearStagebox() {
    this.stagebox.text('');
  }

  quickChange(song) {
    if (song === this.slug) {
      vblog(`Already on ${song}. Nothing to do.`);
      return new Promise(cb => cb());
    }
    let wait = this.reset(song, true);
    return new Promise( cb => {
      d3.timeout( () => {
        if (this.slug === song) {
          this.onReady(cb);
        } else {
          // TODO: There needs to be a better way to deal with this kind of thing.
          // I think this is an argument for splitting into two classes, one
          // permanent (per graphic/svg) and one ephemeral (overwritten on
          // every song change). So any callbacks associated with an overwritten
          // object should just naturally go away.
          // TODO: some way to check whether the initiating stage is still active?
          vblog('Aborting stale QC callback');
        }
      }, wait);
    });
  }

  releaseScrollLock(i) {
    if (this.scroll_owner === i) {
      this.scroll_owner = null;
    }
  }

  acquireScrollLock(i) {
    if (this.scroll_owner !== null) {
      console.warn(`Stage $[i} failed to acquire scroll lock.`);
    } else {
      this.scroll_owner = i;
    }
  }

  onScroll(progress, stage, stagedat) {
    if (stage !== this.scroll_owner) {
      console.warn('Dropping scroll signal from pretender stage.');
      return;
    }
    if (this.state === STATE.loading || this.state === STATE.defragged) {
      return;
    }
    progress = Math.pow(progress, scroll_acceleration);
    let slack = .1; // TODO: Why?
    let offset = stagedat.ditto_offset ? stagedat.ditto_offset : 0;
    let dittorange = this.dittos.length - offset;
    let prog_per_ditto = (1-slack)/dittorange;
    let i = offset + Math.floor(progress/prog_per_ditto);
    if (this.lastditto === i && i === this.dittos.length-1) {
      // We're at the end. We've run out of dittos. Defrag.
      //this.defrag();
    } else {
      this.setLastDitto(i);
    }
  }
  defrag(kwargs={}) {
    if (this.state === STATE.loading || this.state === STATE.defragged) {
      vblog(`Can't defrag in state ${this.state}`);
      return;
    }
    this.state = STATE.defragged;
    let clock = 0;
    let dur;
    const time_pie = {
      erase: .33,
      dittosweep: .33, // concurrent with above?
      crunch: .33,
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

    // Drop dittos to the bottom
    dur = time_pie.dittosweep;
    this.svg.selectAll('.ditto')
      .on('mouseover', null)
      .on('mouseout', null)
      .transition()
      .duration(dur)
      .delay(() => Math.max(0, d3.randomNormal(100, 25)()))
      .ease(d3.easeBounceOut)
      .attr('cy', this.odometer_offset*.95)

    dur = time_pie.crunch;
    this._crunch(dur, clock);
  }
}

export default CompressionWrapper;
