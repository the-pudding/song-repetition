import * as d3 from 'd3';
import scroll_controller from './scroll.js';
import ScrollMagic from 'scrollmagic';
import { BaseCompressionGraphic, STATE } from './compression-base.js';

// TODO: maybe show extended odometer?

const play_accel = (iter, dur) => {
  return Math.max(100, dur * Math.pow(0.9, iter));
};
const play_speed = 4;
const autoplay = 1;
const scroll_acceleration = 1;

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
    this.prose.selectAll('.slide-wrapper').data(this.stage_data)
      .enter()
      .append('div')
      .classed('slide-wrapper', true)
      .classed('first', (d,i) => i===0)
      .classed('progressive', d => d.progressive)
      .append('div')
      .classed('slide', true)
      .html(sd => sd.html)
  }

  // Setup the overall scene wherein the compression graphic is pinned to
  // the top, and the sub-scenes for each stage of the graphic.
  setScene() {
    let viewportHeight = window.innerHeight;
    // TODO: use setpin instead?
    let outerscene = new ScrollMagic.Scene({
      triggerElement: this.rootsel,
      triggerHook: 'onLeave',
      // Allow for the prose to land halfway up before ending the scene
      duration: Math.max(1, this.root.node().offsetHeight - viewportHeight/2),
    })
      .on('enter', () => this.toggleFixed(true, false))
      .on('leave', e => this.toggleFixed(false, e.scrollDirection === 'FORWARD'))
      .addTo(this.controller);

    let slides = this.prose.selectAll('.slide-wrapper');
    // How far down from the top of the viewport does a scene's
    // paragraph become active
    let slide_offset = -1 * viewportHeight * 1/2;
    // TODO: Need some way to ensure no more than one scene can be 
    // active at once. (Otherwise the progress stuff is gonna get fucky.)
    // Maybe need some arbitrator that manages a lock on current scene.
    //
    // Or carefully set each scene's duration to exactly the distance 
    // to the next trigger.
    //
    // TODO YOUAREHERE: Okay, maybe set it up so that instead of using offsets, 
    // we can just use an onLeave trigger on each slide-wrapper element. Then
    // calculating the durations is really easy, cause it's just the height of
    // the slide-wrapper el.
    slides.each( (dat,i,n) => {
      let wrappernode = n[i];
      let stagenode = d3.select(wrappernode).select('.slide');
      let slide_scene = new ScrollMagic.Scene({
        triggerElement: wrappernode,
        triggerHook: 'onLeave',
        duration: wrappernode.offsetHeight,
        //(-1*slide_offset) + (dat.progressive ? viewportHeight/2 : 0), //+ stagenode.offsetHeight/2,
      })
        .on('enter', (e) => {
          let slug = dat.slug;
          let cb = dat.onEnter ? 
            () => dat.onEnter(this.comp, e.scrollDirection === 'FORWARD')
          : () => null;
          if (this.comp.slug != slug) {
            console.log(`Quickchanging. Slide slug = ${slug}, current graphic slug = ${this.comp.slug}`);
            this.comp.quickChange(slug).then(cb);
          } else {
            console.log('No QC necessary. OnEntering.')
            cb();
          }
          console.log(`Entered stage ${i}`);
          stagenode.classed('active', true);
        })
        // NB: when duration is not set, leave event is fired when the 
        // trigger is scrolled past from the opposite scroll direction
        // TODO: this shouldn't be necessary
        .on('leave', (e) => {
          console.log(`Left stage ${i}`);
          stagenode.classed('active', false);
          let exitkey = e.scrollDirection === 'FORWARD' ? 'down' : 'up';
          let exitfn = dat.onExit && dat.onExit[exitkey];
          if (exitfn) {
            exitfn(this.comp);
          }
        })
        .addTo(this.controller);
        if (!autoplay && dat.progressive) {
          slide_scene.on('progress', e => {
            this.comp.onScroll(e.progress);
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
    html: `<p>The Lempel-Ziv algorithm scans the input from beginning to end looking for chunks of text that exactly match earlier parts</p>`,
  },
  {
    html: `<p>The <code>ills</code> in "thrills" is our first non-trivial repetition.</p>`,
    onEnter: (comp, down) => {
      console.assert(comp.slug === 'cheapthrills_chorus', 
          `Wrong song. Expected ct_chorus, got ${comp.slug}`);
      let ditto = comp.dittos[0];
      let highlight_dur = 2500;
      comp.highlightSrc(ditto.src, highlight_dur);
      comp.highlightDest(ditto.dest, highlight_dur);
    },
    onExit: {
      up: (comp) => {
        comp.clearHighlights();
      }
    },
  },

  {
    slug: 'cheapthrills_chorus',
    html: `<p>We replace it with a marker pointing back to the occurrence on the first line, in "bills".</p>
    <p><small>Each signpost is represented by two numbers: how far back the match is, and how long it is. Storing those two numbers takes about as much space as three characters (i.e. about 3 bytes), so it's only worth replacing a repetition if it's longer than that. That's why we didn't replace any of the smaller repeated substrings that occur earlier like <code>I </code> or <code> to</code>.</small></p>`,
    onEnter: (comp) => {
      let ditto = comp.dittos[0];
      let dur = 1000;
      comp.animateArrow(ditto, comp.stagebox, dur, 0);
      // this method name is misleading...
      comp.eraseDitto(ditto, dur, dur, comp.stagebox);
      comp.lastditto = 0;
      comp.updateOdometer();
    },
    onExit: {
      // TODO: Add some transitions to removals
      up: comp => {
        console.log('leaving up-wise');
        comp.stagebox.text('');
        comp.clearMarkers();
        comp.lastditto = -1;
        comp.updateOdometer();
      },
    },
  },

  {
    slug: 'cheapthrills_chorus',
    html: `<p>The third and fourth lines are exact duplicates of the first two, so we can replace them with a single marker. At this point, we've already reduced the size of the chorus by 29%.</p>`,
    onEnter: (comp, down) => {
      if (down) {
        comp.clearHighlights();
        comp.clearArrows();
        comp.step(2500);
      }
      // TODO: draw attention to odometer
    },
    onExit: {
      up: comp => comp.unravel(comp.dittos[1]),
    },
  },

  {
    slug: 'cheapthrills_chorus',
    html: `<p>In the end, the chorus alone is reduced in size 46%.</p>`,
    onEnter: (comp, down) => {
      if (!down) {
        comp.play(4);
        return;
      }
      let dur = 2500;
      for (let i=2; i < comp.dittos.length; i++) {
        comp.ravel(comp.dittos[i], dur);
      }
      comp.updateOdometer();
      let wait = dur;
      d3.timeout( () => comp.defrag(), wait);
    },
    // TODO: gonna be real hard to reverse this :/
    // Need a refrag method, or just kinda do a reset and skip ahead.
  },

  {
    // TODO: need to figure out how to slow down scrolling during
    // these stages
    progressive: true,
    slug: 'thrillscheap',
    html: `<p>How does that compare to my jumbled version of the same words?</p>`,
    onEnter: (comp) => {
      // TODO: try binding to scroll progress rather than just setting 
      // to autoplay
      if (autoplay) {
        // TODO: if doing the progressive thing, need to make sure the
        // progress() calls wait for load
        comp.play(play_speed, play_accel) ;
      }
    },
  },

  {
    progressive: true,
    slug: 'essay_intro',
    html: `<p>What about the first paragraph of this post?</p>`,
    onEnter: (comp) => {
      if (autoplay) {
        comp.play(play_speed, play_accel);
      }
    },
  },
  ]
  }
}

// Maybe not even necessary?
class CompressionTutorial extends BaseCompressionGraphic {

  constructor(rootsel, config={}) {
    super(rootsel, config);
    // Add a container that the stage transitions can use as a sort of 
    // dedicated scratch space.
    this.stagebox = this.svg.append('g')
      .classed('stage-sandbox', true);
    // TODO: technically an extra request here
    this.warmCache(['thrillscheap', 'essay_intro', 'cheapthrills_chorus']);
    this.ravel_duration = 2000;
    this.defrag_duration = 5000;
  }

  quickChange(song) {
    if (song === this.slug) {
      console.log(`Already on ${song}. Nothing to do.`);
      return new Promise(cb => cb());
    }
    let wait = this.reset(song, true);
    return new Promise( cb => {
      d3.timeout( () => {
        if (this.slug === song) {
          this.onReady(cb);
        } else {
          console.log('Aborting stale QC callback');
        }
      }, wait);
    });
  }

  onScroll(progress) {
    if (this.state === STATE.loading || this.state === STATE.defragged) {
      return;
    }
    progress = Math.pow(progress, scroll_acceleration);
    let slack = .1;
    let prog_per_ditto = (1-slack)/this.dittos.length;
    let i = Math.floor(progress/prog_per_ditto);
    if (this.lastditto === i && i === this.dittos.length-1) {
      // We're at the end. We've run out of dittos. Defrag.
      this.defrag();
    } else {
      this.setLastDitto(i);
    }
  }

  renderOdometer() {
    super.renderOdometer();
    // TODO: this results in some jitter when width of text changes
    this.odometer.select('text')
      .attr('text-anchor', 'end');
  }

  odometerWhere() {
    let x = this.W;
    let y = 0;
    return {x,y};
  }

}

export default CompressionWrapper;

