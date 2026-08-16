/* Simulates a mediocre-but-not-stupid player to see whether the match rules
   actually let you survive. Reports pieces survived per game. */
global.window = global;
require(require('path').join(__dirname, '../src/config.js'));
require(require('path').join(__dirname, '../src/engine.js'));
const LOL = global.LOL;
const E = LOL.Engine;
const C = LOL.CONFIG;

function heightOf(b) {
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) if (b.get(x, y)) return b.rows - y;
  }
  return 0;
}

/* Greedy placement: try every column, pick the one that clears the most /
   keeps the stack lowest. Roughly "a player who is paying attention". */
function bestPlacement(b, piece) {
  let best = null;
  for (let rot = 0; rot < 4; rot++) {
    for (let x = -2; x < b.cols; x++) {
      const test = { kind: piece.kind, matrix: piece.matrix, cells: piece.cells, x: x, y: 0 };
      if (b.collides(test, x, 0)) continue;
      const y = b.dropY(test);
      // clone board, place, resolve
      const clone = new E.Board();
      clone.grid = b.grid.slice();
      clone.lock({ matrix: piece.matrix, cells: piece.cells, x: x, y: y });
      let cleared = 0, guard = 0;
      while (guard++ < 60) {
        const hits = clone.findMatches();
        if (!hits.size) break;
        cleared += hits.size;
        clone.remove(hits);
        clone.applyGravity();
      }
      const score = cleared * 10 - heightOf(clone) * 2;
      if (!best || score > best.score) best = { score: score, x: x, y: y, piece: piece };
    }
    piece = E.rotatePiece(piece, 1);
  }
  return best;
}

function playGame(maxPieces) {
  const b = new E.Board();
  let pieces = 0, cleared = 0, cascades = 0, biggest = 0;
  while (pieces < maxPieces) {
    const piece = E.makePiece();
    if (b.collides(piece, piece.x, piece.y)) break; // topped out
    const place = bestPlacement(b, piece);
    if (!place) break;
    b.lock({ matrix: place.piece.matrix, cells: place.piece.cells, x: place.x, y: place.y });
    pieces++;
    let chain = 0, guard = 0;
    while (guard++ < 60) {
      const hits = b.findMatches();
      if (!hits.size) break;
      chain++;
      cleared += hits.size;
      b.remove(hits);
      b.applyGravity();
    }
    if (chain) { cascades++; biggest = Math.max(biggest, chain); }
  }
  return { pieces: pieces, cleared: cleared, cascades: cascades, biggest: biggest, height: heightOf(b) };
}

function report(label) {
  const runs = [];
  for (let i = 0; i < 25; i++) runs.push(playGame(400));
  const avg = (f) => (runs.reduce((s, r) => s + f(r), 0) / runs.length).toFixed(1);
  const survived = runs.filter(r => r.pieces >= 400).length;
  console.log(label);
  console.log('  pieces survived (avg of 25): ' + avg(r => r.pieces) + '   reached 400: ' + survived + '/25');
  console.log('  cells cleared: ' + avg(r => r.cleared) +
              '   clears per piece: ' + (avg(r => r.cleared) / avg(r => r.pieces)).toFixed(2));
  console.log('  best chain: ' + avg(r => r.biggest) + '\n');
}

const regionCounts = [6, 5, 4];
const biases = [0.62, 0.75];

regionCounts.forEach((n) => {
  const all = Object.keys(LOL.REGIONS);
  LOL.REGION_KEYS = all.slice(0, n);
  biases.forEach((bias) => {
    C.PRIMARY_REGION_BIAS = bias;
    report(n + ' regions, bias ' + bias + ', MATCH_MIN ' + C.MATCH_MIN);
  });
});
