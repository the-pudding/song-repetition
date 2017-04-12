import * as d3 from 'd3'
import ArtistCircles from './artists.js';
import OverTime from './overtime.js';
import discog from './discog.js';
import topsongs from './topsongs.js';
import compression from './compression.js';

function resize() {

}

function init() {
  compression.init();
  topsongs.init();
  discog.init();
  ArtistCircles.init();
  OverTime.init();
}

export default { init, resize }
