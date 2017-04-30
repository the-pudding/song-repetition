import * as d3 from 'd3'
import ArtistCircles from './artists.js';
import OverTime from './overtime.js';
import discog from './discog.js';
import topsongs from './topsongs.js';
//import compression from './compression.js';
import compression_tutorial from './compression-tutorial.js';
import histogram from './histogram.js';
import histogram_accordion from './histogram-accordion.js';

function resize() {

}

function init() {
  // XXX: Hack, to make sure scrollmagic doesn't go haywire on page
  // load/refresh
  d3.timeout( () => {
    compression_tutorial.init();
    OverTime.init();
    histogram_accordion.init();
  }, 1000);
  //compression.init();
  histogram.init();
  topsongs.init();
  discog.init();
  ArtistCircles.init();
}

export default { init, resize }
