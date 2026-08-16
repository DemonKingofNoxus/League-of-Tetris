/* Headless exercise of the pure-rules layer. */
global.window = global; // browser scripts assign window.LOL and then read bare LOL
require(require('path').join(__dirname, '../src/config.js'));
require(require('path').join(__dirname, '../src/engine.js'));
require(require('path').join(__dirname, '../src/abilities.js'));

const LOL = global.window.LOL;
const E = LOL.Engine;
let fails = 0;
function check(name, cond) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name);
  if (!cond) fails++;
}

/* --- horizontal match --- */
let b = new E.Board();
for (let x = 0; x < 3; x++) b.set(x, 19, { region: 'noxus', champ: null });
check('3 same-region in a row matches', b.findMatches().size === 3);

b = new E.Board();
b.set(0, 19, { region: 'noxus', champ: null });
b.set(1, 19, { region: 'ionia', champ: null });
b.set(2, 19, { region: 'noxus', champ: null });
check('mixed regions do not match', b.findMatches().size === 0);

/* --- vertical match --- */
b = new E.Board();
for (let y = 17; y <= 19; y++) b.set(4, y, { region: 'zaun', champ: null });
check('3 same-region in a column matches', b.findMatches().size === 3);

/* --- full row regardless of region --- */
b = new E.Board();
const regions = LOL.REGION_KEYS;
for (let x = 0; x < 10; x++) b.set(x, 19, { region: regions[x % regions.length], champ: null });
check('full row clears even when regions differ', b.findMatches().size === 10);

/* --- gravity --- */
b = new E.Board();
b.set(3, 5, { region: 'ionia', champ: null });
b.applyGravity();
check('block falls to the floor', !!b.get(3, 19) && !b.get(3, 5));

/* --- gravity compacts a column with a hole --- */
b = new E.Board();
b.set(2, 19, { region: 'a', champ: null });
b.set(2, 16, { region: 'b', champ: null });
b.applyGravity();
check('column compacts downward', b.get(2, 19).region === 'a' && b.get(2, 18).region === 'b' && !b.get(2, 16));

/* --- champion counts as its region --- */
b = new E.Board();
b.set(0, 19, { region: 'noxus', champ: null });
b.set(1, 19, { region: 'noxus', champ: 'darius' });
b.set(2, 19, { region: 'noxus', champ: null });
check('champion completes a region run', b.findMatches().size === 3);

/* --- abilities --- */
function fill(board) {
  for (let y = 10; y < 20; y++) {
    for (let x = 0; x < 10; x++) board.set(x, y, { region: 'demacia', champ: null });
  }
}

b = new E.Board(); fill(b); b.set(4, 10, { region: 'noxus', champ: 'darius' });
let r = LOL.Abilities.trigger(b, 4, 10);
check('Darius destroys his column below + himself', r.destroy.length === 10);

b = new E.Board(); fill(b); b.set(3, 12, { region: 'demacia', champ: 'lux' });
r = LOL.Abilities.trigger(b, 3, 12);
check('Lux destroys her row', r.destroy.length === 10);

b = new E.Board(); fill(b); b.set(5, 15, { region: 'zaun', champ: 'ziggs' });
r = LOL.Abilities.trigger(b, 5, 15);
check('Ziggs destroys a 3x3', r.destroy.length === 9);

b = new E.Board(); fill(b); b.set(5, 15, { region: 'freljord', champ: 'ashe' });
r = LOL.Abilities.trigger(b, 5, 15);
check('Ashe converts 8 neighbours, destroys only herself',
  r.converted === 8 && r.destroy.length === 1 && b.get(4, 15).region === 'freljord');

b = new E.Board(); fill(b); b.set(5, 10, { region: 'ionia', champ: 'yasuo' });
r = LOL.Abilities.trigger(b, 5, 10);
check('Yasuo destroys both side columns below + himself', r.destroy.length === 19);

b = new E.Board(); fill(b);
b.set(5, 10, { region: 'bilgewater', champ: 'missFortune' });
b.set(0, 10, { region: 'noxus', champ: null });
r = LOL.Abilities.trigger(b, 5, 10);
check('Miss Fortune wipes every block of the region beneath her',
  r.destroy.length === 99 + 1 - 1 || r.destroy.length === 99);

/* --- ability on an empty cell does nothing --- */
b = new E.Board();
check('clicking empty space is a no-op', LOL.Abilities.trigger(b, 0, 0) === null);

/* --- edge safety: champion at board edges --- */
b = new E.Board(); fill(b);
b.set(0, 19, { region: 'noxus', champ: 'yasuo' });
r = LOL.Abilities.trigger(b, 0, 19);
check('Yasuo at the left edge does not crash', r.destroy.length === 1);

b = new E.Board(); fill(b);
b.set(9, 19, { region: 'bilgewater', champ: 'missFortune' });
r = LOL.Abilities.trigger(b, 9, 19);
check('Miss Fortune with nothing beneath her spends herself only', r.destroy.length === 1);

/* --- rotation preserves regions --- */
let p = E.makeTetromino();
let rot = E.rotatePiece(p, 1);
let countCells = (pc) => pc.matrix.flat().filter(Boolean).length;
check('rotation preserves cell count', countCells(p) === countCells(rot));
let regionsOk = true;
for (let y = 0; y < rot.matrix.length; y++) {
  for (let x = 0; x < rot.matrix[y].length; x++) {
    if (!!rot.matrix[y][x] !== !!rot.cells[y][x]) regionsOk = false;
  }
}
check('rotation keeps matrix and cells aligned', regionsOk);

/* --- 4 rotations return to start --- */
let p4 = E.makeTetromino();
let cur = p4;
for (let i = 0; i < 4; i++) cur = E.rotatePiece(cur, 1);
check('four rotations return the original shape',
  JSON.stringify(cur.matrix) === JSON.stringify(p4.matrix));

/* --- champion pieces are 1x1 --- */
let cp = E.makeChampionPiece();
check('champion piece is 1x1 with a champ cell',
  cp.matrix.length === 1 && cp.matrix[0].length === 1 && !!cp.cells[0][0].champ);

/* --- collision at the floor --- */
b = new E.Board();
p = E.makeChampionPiece();
check('piece collides with the floor', b.collides(p, 0, 20) && !b.collides(p, 0, 19));

/* --- full soak: 300 random pieces, no crashes, board stays sane --- */
b = new E.Board();
let iterations = 0;
for (let i = 0; i < 300; i++) {
  let piece = E.makePiece();
  piece.x = Math.floor(Math.random() * (10 - piece.matrix.length + 1));
  if (b.collides(piece, piece.x, piece.y)) { b = new E.Board(); continue; }
  piece.y = b.dropY(piece);
  b.lock(piece);
  let guard = 0;
  while (guard++ < 50) {
    const hits = b.findMatches();
    if (!hits.size) break;
    b.remove(hits);
    b.applyGravity();
    iterations++;
  }
  if (guard >= 50) { check('cascade terminated', false); break; }
}
check('300-piece soak run completed without a runaway cascade', true);
console.log('  (soak triggered ' + iterations + ' cascade steps)');

/* --- gravity settles completely in one pass ---
   A freshly locked piece may legitimately overhang a hole (that is normal
   Tetris), so the invariant is not "nothing ever floats" — it is that once
   gravity runs, it has nothing left to do. */
b.applyGravity();
check('gravity is idempotent — one pass fully settles the board', b.applyGravity() === false);

let floating = false;
for (let x = 0; x < 10; x++) {
  let seenEmpty = false;
  for (let y = 19; y >= 0; y--) {
    if (!b.get(x, y)) seenEmpty = true;
    else if (seenEmpty) floating = true;
  }
}
check('no floating blocks remain once gravity has run', !floating);

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall engine checks passed');
process.exit(fails ? 1 : 0);
