import * as d3 from 'd3'
import ArtistCircles from './artists.js';
import OverTime from './overtime.js';
import scroll from './helloscroll.js';

function resize() {

}

function init() {
  console.log('Make something awesome!');
  ArtistCircles.init();
  OverTime.init();
  scroll.init();
}

export default { init, resize }
