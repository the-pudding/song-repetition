import * as d3 from 'd3'
import ArtistCircles from './artists.js';
import OverTime from './overtime.js';
import discog from './discog.js';
import topsongs from './topsongs.js';
import compression from './compression.js';
import compression_tutorial from './compression-tutorial.js';
import histogram from './histogram.js';

function resize() {

}

function init() {
  compression_tutorial.init();
  compression.init();
  histogram.init();
  topsongs.init();
  discog.init();
  ArtistCircles.init();
  OverTime.init();
}

export default { init, resize }
