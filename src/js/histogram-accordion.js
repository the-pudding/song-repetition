import * as d3 from 'd3';
import scroll_controller from './scroll.js';
import ScrollMagic from 'scrollmagic';
import HistogramGraphic from './histogram.js';

const ndrops = 20;

class HistogramAccordionGraphic extends HistogramGraphic {

  constructor(rootsel, to_drop) {
    super(rootsel, to_drop);
    this.controller = scroll_controller;
    this.setScene();
  }

  setScene() {
    let scene = new ScrollMagic.Scene({
        triggerElement: this.rootsel,
        triggerHook: 'onLeave',
        offset: -100,
    })
      .on('enter', () => {
        this.updateToDrop(0);
        console.log('enter the accordion');
      })
      .on('leave', () => {
        this.updateToDrop(ndrops);
        console.log('leave the accordion');
      })
      .addTo(this.controller);
  }

  updateToDrop(td) {
    if (td === this.to_drop) {
      return;
    }
    this.to_drop = td;
    this.updateData();
  }

  static init() {
    new HistogramAccordionGraphic('#histogram-full', ndrops);
  }
}

export default HistogramAccordionGraphic;
