import * as d3 from 'd3';
import * as c from './constants.js';
import * as comm from './common.js';
import TOPS from './topsongs-data.js';
import { decade_controls } from './helpers.js';

const default_nsongs = 10;
const more_songs = 30;
// TODO: maybe rather than doing it this way, we should make the x scale using
// the true data domain, and start the range at some value > 0
const rscore_axis_min = 1;

const col_headings = ['', 'Track', 'Size Reduction'];

// TODO:
// - animate expand/contract
class TopSongsGraphic {
  constructor() {
    this.root = d3.select('#topsongs');
    this.W = this.root.node().offsetWidth;
    this.minyear = c.minyear;
    this.maxyear = c.maxyear;

    this.table = this.root.select('table');
    this.tbody = this.table.select('tbody');
    this.setupControls();
    // tbody
    this.maxbar = this.W * .4; // TODO: DRY

    // How many songs are visible right now
    // (Actually, this is more like the current song limit)
    this.nsongs = default_nsongs;
    this.barscale = d3.scaleLinear()
      .domain([rscore_axis_min, d3.max(TOPS, s=>s.rscore)])
      .range([0, this.maxbar]);

    this.expanded = false;
    this.resizer = this.root.select('.expander')
    this.resizer
      .on('click', ()=> this.showMoreLess())
    this.updateResizer();

    this.setupHeader();
    this.renderSongs();
  }

  // Called when clicking the resizer
  showMoreLess() {
    let ns = [default_nsongs, more_songs];
    this.expanded = !this.expanded;
    let i = this.expanded ? 1 : 0;
    this.nsongs = ns[i];
    this.updateResizer();
    this.renderSongs();
  }

  // Hacky transition for adding rows. Not currently used.
  accordion(rows) {
    let rowtime = 60;
    rows
      .style('opacity', '0')
      .style('transform', 'translateY(-50px)')
      .transition()
      .delay( (d,i) => (i-10)*rowtime)
      .duration(rowtime)
      .style('opacity', '1')
      .style('transform', 'translateY(0)');
  }

  updateResizer() {
    this.resizer
      .text(this.expanded ? "Show less..." : "Show more...")
  }

  setupControls() {
    decade_controls(this.root.select('.decade-controls'))
      .on('click', decade=>{this.setYears(decade.earliest, decade.latest)});
    this.updateControls();
  }

  updateControls() {
    this.root.selectAll('.decade')
      .classed('active', d=>(d.earliest===this.minyear && d.latest==this.maxyear));
  }

  setYears(y1, y2) {
    if (y1 === this.minyear && y2 === this.maxyear) {
      return;
    }
    this.minyear = y1;
    this.maxyear = y2;
    this.updateControls();
    this.renderSongs();
  }

  renderSongs() {
    let dur = 1000;
    let songdat = TOPS.filter(s => 
        (s.year >= this.minyear && s.year <= this.maxyear)
    ).slice(0, this.nsongs);
    // TODO: would like to achieve object constancy here, but it seems hard :/
    // sigh. Probably need to redo this with div-rows having fixed height? Maybe
    // even in svg? Bleh.
    let rows = this.tbody.selectAll('tr').data(songdat, sd=>sd.title);
    // TODO: transition me
    rows.exit()
      .remove();
    // Only thing we need to change in the update case is the rank
    // TODO: er, well, okay, also need to move its position in the table
    let ranktext = (d,i) => i+1 + '.';
    rows.select('.rank')
      .text(ranktext);
    let newrows = rows.enter()
      .append('tr')
    newrows.append('td')
      .classed('rank', true)
      .text(ranktext);
    let labelfn = s => `<span class="title">${s.title}</span> - ${s.artist}, ${s.year}`;
    newrows.append('td')
      .classed('track', true)
      .html(labelfn);
    let reduc = newrows.append('td')
      .classed('reduction', true);
    let bar = reduc.append('div')
      .classed('bar', true)
      .style('width', s => this.barscale(s.rscore)+'px')
      .style('background-color', s=> comm.rscore_cmap(s.rscore))
      .append('span')
        .text(s => comm.rscore_to_readable(s.rscore));

    //newrows.style('background-color', '#fff').transition().duration(dur).style('background-color', '#ddf')
  }

  setupHeader() {
    let head = this.table.select('thead tr');
    head.selectAll('th').data(col_headings)
      .enter()
      .append('th')
      .text(h=>h);
  }

  static init() {
    let g = new TopSongsGraphic();
    return g;
  }
}

export default TopSongsGraphic;
