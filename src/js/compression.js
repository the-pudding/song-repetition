import * as d3 from 'd3';
import { BaseCompressionGraphic } from './compression-base.js';

const default_song = 'cheapthrills_chorus';

/* The 'main' compression graphic (the full-width one without accompanying
 * explanatory text and scrollytelling. */
class CompressionGraphic extends BaseCompressionGraphic {

  constructor(rootsel) {
    let config = {
      song: default_song,
      W: 1100, ncols: 2, H: 600,
    };
    super(rootsel, config);
    this.ravel_duration = 3000;
    this.renderButtons();
  }

  // TODO: make sure this is periodically called. Maybe need a generic 
  // "onChange" method.
  renderButtons() {
    let butcon = this.root.select('.button-container');
    if (butcon.empty()) {
      butcon = this.root.insert('div', ':first-child')
        .classed('button-container', true);
    }
    let button_data = [
      {
        name: 'play', cb: () => this.play(), visible: () => (!this.running)
      },
      {name: 'pause', cb: () => this.pause(), visible: () => this.running
      },
      {name: 'step', cb: () => this.step(), visible: () => !this.running
      },
    ];
    let visible_buttdata = button_data.filter(bd=>bd.visible());
    let butts = butcon.selectAll('button').data(visible_buttdata)
    let newbutts = butts.enter()
      .append('button')
      .classed('btn', true);
    butts.merge(newbutts)
      .text(bd => bd.name)
      .on('click', bd => bd.cb());
  }

  static init() {
    let c = new CompressionGraphic('#compression');
  }
}

export default CompressionGraphic;
