import * as d3 from 'd3';
import scroll_controller from './scroll.js';
import ScrollMagic from 'scrollmagic';
import { BaseCompressionGraphic } from './compression-base.js';

// TODO: maybe show extended odometer?

const play_accel = 1.1;
const play_speed = 2;

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
      .append('div')
      .classed('slide', true)
      .html(sd => sd.html)
  }

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

    let slides = this.prose.selectAll('.slide');
    let slide_offset = -1 * viewportHeight * 2/5;
    slides.each( (dat,i,n) => {
      let stagenode = n[i];
      let slide_scene = new ScrollMagic.Scene({
        triggerElement: stagenode,
        triggerHook: 'onLeave',
        // TODO: should probably be a function of viewport height
        offset: slide_offset, 
        duration: (-1*slide_offset) + stagenode.offsetHeight/2,
      })
        .on('enter', (e) => {
          if (dat.onEnter) {
            dat.onEnter(this.comp, e.scrollDirection === 'FORWARD');
          }
          d3.select(stagenode).classed('active', true);
        })
        .on('leave', (e) => {
          d3.select(stagenode).classed('active', false);
          let exitkey = e.scrollDirection === 'FORWARD' ? 'down' : 'up';
          let exitfn = dat.onExit && dat.onExit[exitkey];
          if (exitfn) {
            exitfn(this.comp);
          }
        })
        .addTo(this.controller);
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
    html: `<p>The Lempel-Ziv algorithm scans the input from beginning to end looking for chunks of text that exactly match earlier parts</p>`,
  },
  {
    html: `<p>The <code>ills</code> in "thrills" is out first non-trivial repetition.</p>`,
    onEnter: (comp) => {
      console.assert(comp.slug === 'cheapthrills_chorus');
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
    html: `<p>The third and fourth lines are exact duplicates of the first two, so we can replace them with a single marker. At this point, we've already reduced the size of the chorus by 29%.</p>`,
    onEnter: (comp, down) => {
      if (down) {
        comp.clearHighlights();
        comp.clearArrows();
      }
      comp.step(2500);
      // TODO: draw attention to odometer
    },
    onExit: {
      up: comp => comp.unravel(comp.dittos[1]),
    },
  },

  {
    html: `<p>In the end, the chorus alone is reduced in size 46%.</p>`,
    onEnter: (comp, down) => {
      if (!down) {
        comp.quickChange('cheapthrills_chorus').then(() => {
          // TODO: ravelling should happen at superspeed
          comp.play(4, 0);
        });
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
  },

  {
    html: `<p>How does that compare to my jumbled version of the same words?</p>`,
    onEnter: (comp) => {
      // TODO: try binding to scroll progress rather than just setting 
      // to autoplay
      // TODO: but if it does stick with autoplay, it needs to accelerate
      // and be a bit faster overall
      comp.quickChange('thrillscheap').then( 
        ()=> comp.play(play_speed, play_accel) 
      );
    },
  },

  {
    html: `<p>What about the first paragraph of this post?</p>`,
    onEnter: (comp) => {
      comp.quickChange('essay_intro').then(
        ()=> comp.play(play_speed, play_accel) 
      );
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
      console.log('Already on that song. Nothing to do.');
      return new Promise(cb => cb());
    }
    let wait = this.reset(song, true);
    return new Promise( cb => {
      d3.timeout( () => this.onReady(cb), wait);
    });
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

