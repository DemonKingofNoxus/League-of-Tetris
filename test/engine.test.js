/* Headless exercise of the pure-rules layer. */
global.window = global; // browser scripts assign window.LOL and then read bare LOL
const path = require('path');
require(path.join(__dirname, '../src/config.js'));
require(path.join(__dirname, '../src/engine.js'));
require(path.join(__dirname, '../src/abilities.js'));

const LOL = global.window.LOL;
const E = LOL.Engine;
const C = LOL.CONFIG;
let fails = 0;
function check(name, cond) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name);
  if (!cond) fails++;
}
function section(t) { console.log('\n— ' + t); }

const R = LOL.REGION_KEYS;
function cell(region) { return { region: region, champ: null }; }
function fillRow(b, y, region) {
  for (let x = 0; x < b.cols; x++) b.set(x, y, cell(region || R[x % R.length]));
}
function fillArea(board, region, fromY) {
  for (let y = fromY === undefined ? 10 : fromY; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) board.set(x, y, cell(region || 'ionia'));
  }
}

/* ------------------------------------------------------------------ */
section('configuration');

check('13 regions are configured', R.length === 13);
check('13 champions are configured', LOL.CHAMPION_KEYS.length === 13);
check('every region has exactly one champion',
  R.filter(function (r) { return !LOL.CHAMPION_BY_REGION[r]; }).length === 0);

let missing = LOL.CHAMPION_KEYS.filter(function (k) {
  return !LOL.Abilities.table[LOL.CHAMPIONS[k].ability];
});
check('every champion has an implemented ability: ' + (missing.join(',') || 'none'),
  missing.length === 0);

let badRegion = LOL.CHAMPION_KEYS.filter(function (k) {
  return !LOL.REGIONS[LOL.CHAMPIONS[k].region];
});
check('every champion belongs to a real region: ' + (badRegion.join(',') || 'none'),
  badRegion.length === 0);

/* ------------------------------------------------------------------ */
section('row clearing');

let b = new E.Board();
fillRow(b, 19);
check('a full row clears whatever the regions are', b.fullRows().length === 1);

b = new E.Board();
for (let x = 0; x < b.cols - 1; x++) b.set(x, 19, cell('noxus'));
check('a row with a gap does not clear', b.fullRows().length === 0);

b = new E.Board();
fillRow(b, 19, 'noxus');
check('a single-region row is reported pure', b.fullRows()[0].region === 'noxus');

b = new E.Board();
fillRow(b, 19, 'noxus');
b.set(4, 19, cell('ionia'));
check('one foreign block breaks purity', b.fullRows()[0].region === null);

b = new E.Board();
fillRow(b, 19, 'zaun'); fillRow(b, 18, 'zaun'); fillRow(b, 17);
let rows = b.fullRows();
check('multiple full rows are all found', rows.length === 3);
check('purity is tracked per row', rows.filter(function (r) { return r.region; }).length === 2);

b = new E.Board();
fillRow(b, 19, 'noxus');
b.set(5, 19, { region: 'noxus', champ: 'darius' });
check('a champion of the same region keeps a row pure', b.fullRows()[0].region === 'noxus');

/* ------------------------------------------------------------------ */
section('champion activation by contact');

b = new E.Board();
b.set(5, 19, { region: 'noxus', champ: 'darius' });
check('an isolated champion just settles', b.nextTriggeredChampion() === null);

b.set(4, 19, cell('ionia'));
check('contact with a foreign region does not fire', b.nextTriggeredChampion() === null);

b.set(4, 19, cell('noxus'));
let t = b.nextTriggeredChampion();
check('contact with his own region fires', !!t && t.key === 'darius' && t.x === 5);

b = new E.Board();
b.set(5, 18, { region: 'noxus', champ: 'darius' });
b.set(5, 19, cell('noxus'));
check('contact from below fires', !!b.nextTriggeredChampion());

b = new E.Board();
b.set(5, 19, { region: 'noxus', champ: 'darius' });
b.set(4, 18, cell('noxus'));
check('diagonal contact does not fire by default', b.nextTriggeredChampion() === null);
C.CHAMPION_CONTACT_DIAGONAL = true;
check('diagonal contact fires when enabled', !!b.nextTriggeredChampion());
C.CHAMPION_CONTACT_DIAGONAL = false;

b = new E.Board();
b.set(5, 19, { region: 'noxus', champ: 'darius' });
b.set(4, 19, { region: 'noxus', champ: 'darius' });
check('two champions of one region set each other off', !!b.nextTriggeredChampion());

/* ------------------------------------------------------------------ */
section('abilities');

const COLS = C.COLS, ROWS = C.ROWS;

b = new E.Board(); fillArea(b); b.set(4, 10, { region: 'noxus', champ: 'darius' });
let r = LOL.Abilities.trigger(b, 4, 10);
check('Darius executes the column below him, and himself', r.destroy.length === ROWS - 10);

b = new E.Board(); fillArea(b); b.set(3, 12, { region: 'ionia', champ: 'ahri' });
r = LOL.Abilities.trigger(b, 3, 12);
check('Ahri destroys her row', r.destroy.length === COLS);

b = new E.Board(); fillArea(b); b.set(5, 15, { region: 'void', champ: 'kaisa' });
r = LOL.Abilities.trigger(b, 5, 15);
check("Kai'Sa hits the 3x3 around her", r.destroy.length === 9);

b = new E.Board(); fillArea(b); b.set(5, 15, { region: 'freljord', champ: 'sejuani' });
r = LOL.Abilities.trigger(b, 5, 15);
check('Sejuani wipes the whole board', r.destroy.length === COLS * (ROWS - 10));

b = new E.Board(); fillArea(b); b.set(5, 15, { region: 'targon', champ: 'aurelionSol' });
r = LOL.Abilities.trigger(b, 5, 15);
check('Aurelion Sol wipes the board and pays a bonus',
  r.destroy.length === COLS * (ROWS - 10) && r.bonus === C.AURELION_BONUS);

/* Kayle: a filled disc, symmetric about her. */
b = new E.Board(); fillArea(b, 'ionia', 4); b.set(6, 12, { region: 'demacia', champ: 'kayle' });
r = LOL.Abilities.trigger(b, 6, 12);
let coords = r.destroy.map(function (i) { return [i % COLS, Math.floor(i / COLS)]; });
let allInRadius = coords.every(function (p) {
  const dx = p[0] - 6, dy = p[1] - 12;
  return Math.sqrt(dx * dx + dy * dy) <= C.KAYLE_RADIUS + 0.001;
});
check('Kayle only destroys inside her circle', allInRadius);
check('Kayle destroys a meaningful disc', r.destroy.length >= 15 && r.destroy.length <= 30);

/* Gwen: cone widens downward, nothing above her. */
b = new E.Board(); fillArea(b, 'ionia', 2); b.set(6, 6, { region: 'shadowIsles', champ: 'gwen' });
r = LOL.Abilities.trigger(b, 6, 6);
coords = r.destroy.map(function (i) { return [i % COLS, Math.floor(i / COLS)]; });
check('Gwen hits nothing above herself',
  coords.every(function (p) { return p[1] >= 6; }));
check('Gwen widens as she goes down', coords.every(function (p) {
  return p[1] === 6 ? p[0] === 6 : Math.abs(p[0] - 6) <= (p[1] - 6);
}));

/* Pyke: both diagonals only. */
b = new E.Board(); fillArea(b, 'ionia', 0); b.set(5, 10, { region: 'bilgewater', champ: 'pyke' });
r = LOL.Abilities.trigger(b, 5, 10);
coords = r.destroy.map(function (i) { return [i % COLS, Math.floor(i / COLS)]; });
check('Pyke only hits the two diagonals', coords.every(function (p) {
  return Math.abs(p[0] - 5) === Math.abs(p[1] - 10);
}));
check('Pyke reaches all four arms', coords.length > 12);

/* Qiyana: a hollow ring — the centre survives. */
b = new E.Board(); fillArea(b, 'ionia', 0); b.set(6, 10, { region: 'ixtal', champ: 'qiyana' });
r = LOL.Abilities.trigger(b, 6, 10);
let hit = new Set(r.destroy);
check('Qiyana leaves the inside of the O intact',
  !hit.has(b.idx(6, 9)) && !hit.has(b.idx(7, 10)) && !hit.has(b.idx(5, 10)));
check('Qiyana destroys the ring itself', hit.has(b.idx(6, 7)) && hit.has(b.idx(6, 13)));

/* Teemo: at most 3 shrooms x 4 cells. */
b = new E.Board(); fillArea(b, 'ionia', 0); b.set(5, 5, { region: 'bandleCity', champ: 'teemo' });
r = LOL.Abilities.trigger(b, 5, 5);
check('Teemo destroys at most 3 shrooms worth of blocks',
  r.destroy.length <= C.TEEMO_SHROOMS * 4 + 1);
check('Teemo never lists the same block twice',
  new Set(r.destroy).size === r.destroy.length);

/* Sivir: her region only. */
b = new E.Board(); fillArea(b, 'ionia');
for (let x = 0; x < COLS; x++) b.set(x, 14, cell('shurima'));
b.set(5, 12, { region: 'shurima', champ: 'sivir' });
r = LOL.Abilities.trigger(b, 5, 12);
check('Sivir destroys every block of her own region only',
  r.destroy.length === COLS + 1 &&
  r.destroy.indexOf(b.idx(0, 14)) !== -1 &&
  r.destroy.indexOf(b.idx(0, 13)) === -1);

/* Twitch: capped by config and by what exists. */
b = new E.Board(); fillArea(b); b.set(5, 12, { region: 'zaun', champ: 'twitch' });
r = LOL.Abilities.trigger(b, 5, 12);
check('Twitch fires the configured number of shots, plus himself',
  r.destroy.length === C.TWITCH_SHOTS + 1);
check('Twitch never hits the same block twice',
  new Set(r.destroy).size === r.destroy.length);

b = new E.Board();
b.set(5, 19, { region: 'zaun', champ: 'twitch' });
b.set(4, 19, cell('zaun'));
r = LOL.Abilities.trigger(b, 5, 19);
check('Twitch is capped by how many blocks exist', r.destroy.length === 2);

/* Caitlyn: detonates every other champion and folds in their effects. */
b = new E.Board();
fillArea(b, 'ionia', 8);
b.set(2, 8, { region: 'noxus', champ: 'darius' });     // clears its column below
b.set(9, 8, { region: 'void', champ: 'kaisa' });       // clears a 3x3
b.set(5, 8, { region: 'piltover', champ: 'caitlyn' });
r = LOL.Abilities.trigger(b, 5, 8);
hit = new Set(r.destroy);
check('Caitlyn removes every champion block',
  hit.has(b.idx(2, 8)) && hit.has(b.idx(9, 8)) && hit.has(b.idx(5, 8)));
check("Caitlyn applies Darius's column", hit.has(b.idx(2, 19)));
check("Caitlyn applies Kai'Sa's blast", hit.has(b.idx(8, 9)));
check('Caitlyn reports what she chained', r.chained.length === 2);

/* Caitlyn alone should not loop or crash. */
b = new E.Board();
b.set(5, 19, { region: 'piltover', champ: 'caitlyn' });
r = LOL.Abilities.trigger(b, 5, 19);
check('Caitlyn with no other champions spends only herself',
  r.destroy.length === 1 && r.chained.length === 0);

/* Edge safety for every ability: fire each champion in all four corners. */
let crashed = [];
LOL.CHAMPION_KEYS.forEach(function (key) {
  const champ = LOL.CHAMPIONS[key];
  [[0, 0], [COLS - 1, 0], [0, ROWS - 1], [COLS - 1, ROWS - 1]].forEach(function (p) {
    const board = new E.Board();
    fillArea(board, 'ionia', 0);
    board.set(p[0], p[1], { region: champ.region, champ: key });
    try {
      const out = LOL.Abilities.trigger(board, p[0], p[1]);
      if (!out || !Array.isArray(out.destroy)) crashed.push(key + '@' + p);
      out.destroy.forEach(function (i) {
        if (i < 0 || i >= COLS * ROWS) crashed.push(key + ' out-of-range index');
      });
    } catch (err) {
      crashed.push(key + '@' + p + ': ' + err.message);
    }
  });
});
check('every ability survives all four corners: ' + (crashed.join('; ') || 'clean'),
  crashed.length === 0);

check('firing on empty space is a no-op',
  LOL.Abilities.trigger(new E.Board(), 0, 0) === null);

/* ------------------------------------------------------------------ */
section('pieces and the region pool');

E.setActiveRegions(['noxus', 'ionia', 'zaun']);
let seen = {};
for (let i = 0; i < 400; i++) {
  const piece = E.makeTetromino();
  piece.cells.forEach(function (row) {
    row.forEach(function (c) { if (c) seen[c.region] = (seen[c.region] || 0) + 1; });
  });
}
check('only regions in play are generated',
  Object.keys(seen).every(function (k) { return ['noxus', 'ionia', 'zaun'].indexOf(k) !== -1; }));
check('every region in play actually appears', Object.keys(seen).length === 3);

/* The featured region should lead, but not dominate to the exclusion of the
   others — that was the "20 of the same in a row" complaint. */
E.setActiveRegions(LOL.REGION_KEYS.slice(0, 6));
let sequence = [];
function regionOf(piece) {
  for (let y = 0; y < piece.cells.length; y++) {
    for (let x = 0; x < piece.cells[y].length; x++) {
      if (piece.cells[y][x]) return piece.cells[y][x].region;
    }
  }
  return null;
}
for (let i = 0; i < 600; i++) sequence.push(regionOf(E.makeTetromino()));
let longest = 1, current = 1, runs = 1;
for (let i = 1; i < sequence.length; i++) {
  if (sequence[i] === sequence[i - 1]) { current++; }
  else { runs++; current = 1; }
  longest = Math.max(longest, current);
}
const averageRun = sequence.length / runs;

/* The complaint was "20 of the same, then 20 of another". The statistic that
   captures that is the average run length, not the maximum — with a 70%
   featured share a long tail is expected and harmless, but the typical run
   has to be short or the board looks single-coloured. */
check('typical run is short (average ' + averageRun.toFixed(1) + ' <= 5)',
  averageRun <= 5);
check('no run approaches the old 20-in-a-row behaviour (longest ' + longest + ' < 20)',
  longest < 20);

const counts = {};
sequence.forEach(function (r) { counts[r] = (counts[r] || 0) + 1; });
const share = Math.max.apply(null, Object.keys(counts).map(function (k) {
  return counts[k] / sequence.length;
}));
check('no single region dominates the pool (top share ' +
  (share * 100).toFixed(0) + '% <= 45%)', share <= 0.45);

let distinct = new Set(sequence.slice(0, 12)).size;
E.setActiveRegions(['freljord']);
let champPiece = null;
for (let i = 0; i < 200 && !champPiece; i++) {
  const p = E.makeChampionPiece();
  if (p.cells[0][0].champ) champPiece = p;
}
check('champions only spawn for regions in play',
  champPiece && champPiece.cells[0][0].region === 'freljord');

E.setActiveRegions(LOL.REGION_KEYS);

let p = E.makeTetromino();
let rot = E.rotatePiece(p, 1);
const countCells = function (pc) { return pc.matrix.flat().filter(Boolean).length; };
check('rotation preserves cell count', countCells(p) === countCells(rot));

let aligned = true;
for (let y = 0; y < rot.matrix.length; y++) {
  for (let x = 0; x < rot.matrix[y].length; x++) {
    if (!!rot.matrix[y][x] !== !!rot.cells[y][x]) aligned = false;
  }
}
check('rotation keeps matrix and cells aligned', aligned);

let p4 = E.makeTetromino(), cur = p4;
for (let i = 0; i < 4; i++) cur = E.rotatePiece(cur, 1);
check('four rotations return the original shape',
  JSON.stringify(cur.matrix) === JSON.stringify(p4.matrix));

let solid = true;
for (let i = 0; i < 200; i++) {
  const regions = new Set();
  E.makeTetromino().cells.forEach(function (row) {
    row.forEach(function (c) { if (c) regions.add(c.region); });
  });
  if (regions.size !== 1) solid = false;
}
check('a piece is a single region', solid);

let cp = E.makeChampionPiece();
check('champion piece is 1x1 and carries its champion',
  cp.matrix.length === 1 && cp.matrix[0].length === 1 && !!cp.cells[0][0].champ);
check("champion piece carries its champion's region",
  cp.cells[0][0].region === LOL.CHAMPIONS[cp.cells[0][0].champ].region);

check('board is ' + C.COLS + ' wide', new E.Board().cols === C.COLS && C.COLS >= 12);
check('piece collides with the floor',
  new E.Board().collides(cp, 0, C.ROWS) && !new E.Board().collides(cp, 0, C.ROWS - 1));

/* ------------------------------------------------------------------ */
section('full resolve soak');

function resolve(board) {
  let steps = 0, rowsCleared = 0, abilities = 0;
  while (steps++ < 300) {
    const trig = board.nextTriggeredChampion();
    if (trig) {
      const res = LOL.Abilities.trigger(board, trig.x, trig.y);
      if (res) { board.remove(res.destroy); abilities++; }
      else board.set(trig.x, trig.y, null);
      board.applyGravity();
      continue;
    }
    const full = board.fullRows();
    if (full.length) {
      board.removeRows(full);
      rowsCleared += full.length;
      board.applyGravity();
      continue;
    }
    break;
  }
  return { rowsCleared: rowsCleared, abilities: abilities, ran: steps < 300 };
}

b = new E.Board();
let totalRows = 0, totalAbilities = 0, runaway = false;
for (let i = 0; i < 500; i++) {
  let piece = E.makePiece();
  piece.x = Math.floor(Math.random() * (C.COLS - piece.matrix.length + 1));
  if (b.collides(piece, piece.x, piece.y)) { b = new E.Board(); continue; }
  piece.y = b.dropY(piece);
  b.lock(piece);
  const out = resolve(b);
  if (!out.ran) { runaway = true; break; }
  totalRows += out.rowsCleared;
  totalAbilities += out.abilities;
}
check('500-piece soak resolves every time without a runaway loop', !runaway);
check('the soak cleared rows', totalRows > 0);
check('the soak fired champions', totalAbilities > 0);
console.log('  (soak: ' + totalRows + ' rows cleared, ' + totalAbilities + ' abilities fired)');

check('no champion is left in contact once resolve finishes',
  b.nextTriggeredChampion() === null);
check('no full row is left behind once resolve finishes', b.fullRows().length === 0);

b.applyGravity();
check('gravity is idempotent — one pass fully settles the board',
  b.applyGravity() === false);

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall engine checks passed');
process.exit(fails ? 1 : 0);
