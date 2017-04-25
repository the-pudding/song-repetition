import * as d3 from 'd3';
import * as c from './constants.js';
import * as comm from './common.js';
import TOPS from './topsongs-data.js';

const default_nsongs = 10;
const more_songs = 30;
const rscore_axis_min = 1;

// TODO:
// - search bar?
// - animate expand/contract
class TopSongsGraphic {
  constructor() {
    this.root = d3.select('#topsongs');
    this.minyear = c.minyear;
    this.maxyear = c.maxyear;
    this.setupControls();
    // tbody
    this.body = this.root.append('div').classed('chart-body', true);
    this.W = 800;
    this.maxbar = 350; // TODO: DRY
    this.root.style('width', this.W+'px');

    // How many songs are visible right now
    // (Actually, this is more like the current song limit)
    this.nsongs = default_nsongs;
    this.barscale = d3.scaleLinear()
      .domain([rscore_axis_min, d3.max(TOPS, s=>s.rscore)])
      .range([0, this.maxbar]);

    this.expanded = false;
    let resizer = this.root.append('a')
      .classed('resizer btn', true)
      .on('click', ()=> this.showMoreLess())
    this.updateResizer();

    this.setupHeader();
    this.renderSongs();
  }

  showMoreLess() {
    let ns = [default_nsongs, more_songs];
    this.expanded = !this.expanded;
    let i = this.expanded ? 1 : 0;
    this.nsongs = ns[i];
    this.updateResizer();
    this.renderSongs();
  }

  updateResizer() {
    this.root.select('.resizer')
      .text(this.expanded ? "Show less..." : "Show more...")
  }

  setupControls() {
    this.controls = this.root.append('div');
    let decs = this.controls.append('div').classed('decade-controls', true);
    decs.selectAll('a').data(c.pseudo_decades)
      .enter()
      .append('a')
      .classed('decade', true)
      .text(decade => decade.name)
      .on('click', decade=>{this.setYears(decade.earliest, decade.latest)});
    this.updateControls();
  }

  updateControls() {
    this.controls.selectAll('.decade-controls a')
      .classed('active', (d)=>(d.earliest===this.minyear && d.latest==this.maxyear));
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
    let songdat = TOPS.filter(s => 
        (s.year >= this.minyear && s.year <= this.maxyear)
    ).slice(0, this.nsongs);
    let rows = this.body.selectAll('.row').data(songdat);
    rows.exit().remove();
    let newrows = rows.enter().append('div')
      .classed('row', true);
    for (let cellClass of ['rank', 'songlabel', 'barcell', 'pct']) {
      newrows.append('div').classed("cell " + cellClass, true);
    }
    newrows.select('.barcell')
      .append('div')
      .classed('bar', true);
    // Need to re-select to grab newly created rows. (Could also do this op twice, for rows and newrows)
    rows = rows.merge(newrows)
    rows.select('.rank').text( (s, i) => (i+1+"."));
    rows.select('.songlabel').text(s => `${s.title} - ${s.artist} (${s.year})`);
    rows.select('.pct').text(s => comm.rscore_to_readable(s.rscore));
    let barcells = rows.select('.barcell')
      .attr('title', s=>(`${s.raw} -> ${s.icomp}`));
    barcells.select('.bar')
      .style('width', s => (this.barscale(s.rscore)+'px'))
      .style('background-color', s=> comm.rscore_cmap(s.rscore));
  }



  setupHeader() {
  }

  static init() {
    console.log('topsongs!');
    let g = new TopSongsGraphic();
    return g;
  }
}

export default TopSongsGraphic;
