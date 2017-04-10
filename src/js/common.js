
function round(x, places=2) {
  let n = Math.pow(10, places);
  return Math.round(x*n)/n;
}

// actually fraction <1, not pct
function rscore_to_pct(rscore) {
  // using rscore gives the raw size as % of compressed (generally > 100%),
  // using -rscore gives compressed size as % of raw (< 100)
  return 1 - Math.pow(2, -rscore);
}

function rscore_to_readable(rscore, places=0) {
  return round(100 * rscore_to_pct(rscore), places) + '%';
}


export {rscore_to_readable, rscore_to_pct};
