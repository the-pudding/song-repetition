import ScrollMagic from 'scrollmagic';
// Need to import this here to use indicates in scenes created elsewhere
import 'scrollmagic/scrollmagic/uncompressed/plugins/debug.addIndicators.js'

// Single global SM controller shared across graphics
const controller = new ScrollMagic.Controller();

export default controller;

