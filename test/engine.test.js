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

const R = LOL.REGION_KEYS;
function cell(region) { return { region: region, champ: null }; }
function fillRow(b, y, region) {
  for (let x = 0; x < b.cols; x++) b.set(x, y, cell(region || R[x % R.length]));
}

/* ------------------------------------------------------------------ */
/* Row clearing                                                        */
/* ------------------------------------------------------------------ */

let b = new E.Board();
fillRow(b, 19);
check('a full row clears whatever the regions are', b.fullRows().length === 1);

b = new E.Board();
for (let x = 0; x < 9; x++) b.set(x, 19, cell('noxus'));
check('a row with a gap does not clear', b.fullRows().length === 0);

b = new E.Board();
for (let x = 0; x < 3; x++) b.set(x, 19, cell('noxus'));
check('three in a row no longer clears anything', b.fullRows().length === 0);

b = new E.Board();
fillRow(b, 19, 'noxus');
check('a single-region row is reported pure', b.fullRows()[0].region === 'noxus');

b = new E.Board();
fillRow(b, 19, 'noxus');
b.set(4, 19, cell('ionia'));
check('one foreign block breaks purity', b.fullRows()[0].region === null);

b = new E.Board();
fillRow(b, 19, 'zaun'); fillRow(b, 18, 'zaun'); fillRow(b, 17);
const rows = b.fullRows();
check('multiple full rows are all found', rows.length === 3);
check('purity is tracked per row', rows.filter(function (r) { return r.region; }).length === 2);

b = new E.Board();
fillRow(b, 19, 'noxus');
b.removeRows(b.fullRows());
check('removeRows empties the row', b.fullRows().length === 0 && !b.get(0, 19));

/* A champion sitting in an otherwise pure row still counts: it carries the
   region of the champion, so the row stays pure. */
b = new E.Board();
fillRow(b, 19, 'noxus');
b.set(5, 19, { region: 'noxus', champ: 'darius' });
check('a champion of the same region keeps a row pure', b.fullRows()[0].region === 'noxus');

/* ------------------------------------------------------------------ */
/* Champion contact activation                                         */
/* ------------------------------------------------------------------ */

b = new E.Board();
b.set(5, 19, { region: 'noxus', champ: 'darius' });
check('an isolated champion does not fire', b.nextTriggeredChampion() === null);

b = new E.Board();
b.set(5, 19, { region: 'noxus', champ: 'darius' });
b.set(4, 19, cell('ionia'));
check('contact with a foreign region does not fire', b.nextTriggeredChampion() === null);

b = new E.Board();
b.set(5, 19, { region: 'noxus', champ: 'darius' });
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
/* Abilities                                                           */
/* ------------------------------------------------------------------ */

function fill(board, region) {
  for (let y = 10; y < 20; y++) {
    for (let x = 0; x < 10; x++) board.set(x, y, cell(region || 'ionia'));
  }
}

b = new E.Board(); fill(b); b.set(4, 10, { region: 'noxus', champ: 'darius' });
let r = LOL.Abilities.trigger(b, 4, 10);
check('Darius executes the column below him, and himself', r.destroy.length === 10);

b = new E.Board(); fill(b); b.set(3, 12, { region: 'ionia', champ: 'ahri' });
r = LOL.Abilities.trigger(b, 3, 12);
check('Ahri destroys her row', r.destroy.length === 10);

b = new E.Board(); fill(b); b.set(5, 15, { region: 'void', champ: 'kaisa' });
r = LOL.Abilities.trigger(b, 5, 15);
check("Kai'Sa hits the 3x3 around her", r.destroy.length === 9);

b = new E.Board(); fill(b); b.set(5, 15, { region: 'freljord', champ: 'sejuani' });
r = LOL.Abilities.trigger(b, 5, 15);
check('Sejuani wipes the entire board', r.destroy.length === 100);

/* Sivir kills her own region everywhere, and nothing else. */
b = new E.Board(); fill(b, 'ionia');
for (let x = 0; x < 10; x++) b.set(x, 14, cell('shurima'));
b.set(5, 12, { region: 'shurima', champ: 'sivir' });
r = LOL.Abilities.trigger(b, 5, 12);
check('Sivir destroys every block of her own region only',
  r.destroy.length === 11 && r.destroy.indexOf(b.idx(0, 14)) !== -1 &&
  r.destroy.indexOf(b.idx(0, 13)) === -1);

b = new E.Board(); fill(b); b.set(5, 12, { region: 'zaun', champ: 'twitch' });
r = LOL.Abilities.trigger(b, 5, 12);
check('Twitch fires the configured number of shots, plus himself',
  r.destroy.length === C.TWITCH_SHOTS + 1);
check('Twitch never hits the same block twice',
  new Set(r.destroy).size === r.destroy.length);

/* Twitch on a nearly empty board cannot shoot more than exists. */
b = new E.Board();
b.set(5, 19, { region: 'zaun', champ: 'twitch' });
b.set(4, 19, cell('zaun'));
r = LOL.Abilities.trigger(b, 5, 19);
check('Twitch is capped by how many blocks exist', r.destroy.length === 2);

/* Edge safety */
b = new E.Board(); fill(b); b.set(0, 19, { region: 'void', champ: 'kaisa' });
r = LOL.Abilities.trigger(b, 0, 19);
check("Kai'Sa in the bottom-left corner does not crash", r.destroy.length === 4);

b = new E.Board(); b.set(9, 0, { region: 'noxus', champ: 'darius' });
r = LOL.Abilities.trigger(b, 9, 0);
check('Darius with nothing below him spends only himself', r.destroy.length === 1);

check('clicking empty space is a no-op', LOL.Abilities.trigger(new E.Board(), 0, 0) === null);

/* Every champion in config has an ability implemented. */
let missing = LOL.CHAMPION_KEYS.filter(function (k) {
  return !LOL.Abilities.table[LOL.CHAMPIONS[k].ability];
});
check('every configured champion has an implemented ability: ' + (missing.join(',') || 'none'),
  missing.length === 0);

/* Every champion belongs to a region that exists. */
let badRegion = LOL.CHAMPION_KEYS.filter(function (k) {
  return !LOL.REGIONS[LOL.CHAMPIONS[k].region];
});
check('every champion belongs to a real region: ' + (badRegion.join(',') || 'none'),
  badRegion.length === 0);

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

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

/* At the default bias of 1.0 a piece should be one solid region. */
let solid = true;
for (let i = 0; i < 200; i++) {
  const piece = E.makeTetromino();
  const regions = new Set();
  piece.cells.forEach(function (row) {
    row.forEach(function (c) { if (c) regions.add(c.region); });
  });
  if (regions.size !== 1) solid = false;
}
check('at bias 1.0 every piece is a single region', solid);

let cp = E.makeChampionPiece();
check('champion piece is 1x1 and carries its champion',
  cp.matrix.length === 1 && cp.matrix[0].length === 1 && !!cp.cells[0][0].champ);
check('champion piece carries its champion\'s region',
  cp.cells[0][0].region === LOL.CHAMPIONS[cp.cells[0][0].champ].region);

b = new E.Board();
check('piece collides with the floor',
  b.collides(cp, 0, 20) && !b.collides(cp, 0, 19));

/* ------------------------------------------------------------------ */
/* Full resolve soak — mirrors what main.js does, and must terminate    */
/* ------------------------------------------------------------------ */

function resolve(board) {
  let steps = 0, rowsCleared = 0, abilitiesFired = 0;
  while (steps++ < 200) {
    const trig = board.nextTriggeredChampion();
    if (trig) {
      const res = LOL.Abilities.trigger(board, trig.x, trig.y);
      if (res) { board.remove(res.destroy); abilitiesFired++; }
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
  return { steps: steps, rowsCleared: rowsCleared, abilitiesFired: abilitiesFired, ran: steps < 200 };
}

b = new E.Board();
let totalRows = 0, totalAbilities = 0, runaway = false;
for (let i = 0; i < 400; i++) {
  let piece = E.makePiece();
  piece.x = Math.floor(Math.random() * (10 - piece.matrix.length + 1));
  if (b.collides(piece, piece.x, piece.y)) { b = new E.Board(); continue; }
  piece.y = b.dropY(piece);
  b.lock(piece);
  const out = resolve(b);
  if (!out.ran) { runaway = true; break; }
  totalRows += out.rowsCleared;
  totalAbilities += out.abilitiesFired;
}
check('400-piece soak resolves every time without a runaway loop', !runaway);
check('the soak actually cleared rows', totalRows > 0);
check('the soak actually fired champions', totalAbilities > 0);
console.log('  (soak: ' + totalRows + ' rows cleared, ' + totalAbilities + ' abilities fired)');

check('no champion is left in contact once resolve finishes',
  b.nextTriggeredChampion() === null);
check('no full row is left behind once resolve finishes', b.fullRows().length === 0);

b.applyGravity();
check('gravity is idempotent — one pass fully settles the board',
  b.applyGravity() === false);

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall engine checks passed');
process.exit(fails ? 1 : 0);
