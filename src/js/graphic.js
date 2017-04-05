import * as d3 from 'd3'
import ArtistCircles from './artists.js';
import OverTime from './overtime.js';
import discog from './discog.js';

function resize() {

}

function init() {
  console.log('Make something awesome!');
  discog.init();
  ArtistCircles.init();
  OverTime.init();
}

export default { init, resize }
