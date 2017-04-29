import * as c from './constants.js';

function decade_controls(root) {
    return root.selectAll('a').data(c.pseudo_decades)
      .enter()
      .append('a')
      .classed('decade', true)
      .text(decade => decade.name)
}

export { decade_controls };
