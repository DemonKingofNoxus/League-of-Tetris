/*
 * rates.js — prints the probabilities actually in force, level by level.
 *
 *   node tools/rates.js            all levels
 *   node tools/rates.js 7          just level 7
 *
 * Everything here is read out of src/config.js through the same tuning layer
 * the game uses, so it always matches what you would really get in play.
 */
global.window = global;
const path = require('path');
require(path.join(__dirname, '../src/config.js'));
require(path.join(__dirname, '../src/tuning.js'));
require(path.join(__dirname, '../src/engine.js'));

const LOL = global.LOL;
const C = LOL.CONFIG;
const T = LOL.Tuning;
const E = LOL.Engine;

const pct = function (v) { return (v * 100).toFixed(2).padStart(6) + '%'; };

function regionsAtLevel(level) {
  return Math.min(LOL.REGION_KEYS.length,
    C.LEVEL_REGIONS_START + Math.min(level, C.LEVEL_COUNT) - 1);
}

function report(level) {
  T.setLevel(level);

  const n = regionsAtLevel(level);
  /* Which regions are actually in play depends on a random draw each game, so
     use the first n as a stand-in — the maths only depends on how many. */
  const regions = LOL.REGION_KEYS.slice(0, n);
  E.setActiveRegions(regions);

  const champChance = T.value('CHAMPION_CHANCE');
  const featured = T.value('FEATURED_SHARE');
  const matches = T.value('CHAMPION_MATCHES_FEATURE');
  const other = n > 1 ? (1 - featured) / (n - 1) : 1;

  console.log('\n══ Level ' + level + '  (' + n + ' regions in play) ══');
  console.log('  piece is a champion        ' + pct(champChance));
  console.log('  piece is a tetromino       ' + pct(1 - champChance));
  console.log('  each of the 7 shapes       ' + pct(1 / LOL.SHAPE_KEYS.length));
  console.log('  featured region            ' + pct(featured));
  console.log('  each other region          ' + pct(other) + '   (long-run per region ' + pct(1 / n) + ')');
  console.log('  champion matches feature   ' + pct(matches));

  const inPlay = E.championsInPlay();
  const shares = T.championShares(inPlay);

  console.log('  champion spawn shares (weight -> share of champion pieces -> share of all pieces):');
  inPlay.slice().sort(function (a, b) {
    return T.championWeight(b) - T.championWeight(a) ||
           LOL.CHAMPIONS[a].name.localeCompare(LOL.CHAMPIONS[b].name);
  }).forEach(function (k) {
    const champ = LOL.CHAMPIONS[k];
    const isFeaturedRegion = 1 / n;   // chance this champion's region is featured
    /* Weighted draw, plus the featured-region shortcut when it lands here. */
    const share = matches * isFeaturedRegion + (1 - matches) * shares[k];
    console.log('    ' + champ.name.padEnd(14) +
                'w=' + String(T.championWeight(k)).padStart(4) + '   ' +
                pct(share) + '   ' + pct(share * champChance));
  });
}

const only = Number(process.argv[2]);
if (only) {
  report(only);
} else {
  for (let level = 1; level <= C.LEVEL_COUNT; level++) report(level);
}
console.log('');
