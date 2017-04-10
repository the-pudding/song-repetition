const runits = 'pct';

const year_extent = [1960, 2015];
const minyear = year_extent[0];
const maxyear = year_extent[1];

const decades = [];
for (let d=6; d<=11; d++) {
  let name;
  if (d === 11) {
    name = "10's";
  } else if (d === 10) {
    name = "00's";
  } else {
    name = d*10 + "'s";
  }
  let decade = {earliest: 1900+d*10, latest: 1900+d*10+9, name: name};
  decades.push(decade);
}

const pseudo_decades = decades;
pseudo_decades.push(
    {earliest: minyear, latest: maxyear, name: 'All'}
);

export {runits, year_extent, minyear, maxyear, pseudo_decades};
