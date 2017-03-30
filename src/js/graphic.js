import * as d3 from 'd3'
import ArtistCircles from './artists.js';
import OverTimeChart from './overtime.js';

function resize() {

}

function init() {
  console.log('Make something awesome!');
  ArtistCircles.init();
  OverTimeChart.init();
}

export default { init, resize }
