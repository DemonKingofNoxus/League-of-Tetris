/*
 * engine.js — rules only. No canvas, no DOM, no input.
 *
 * A board cell is either null (empty) or:
 *   { region: 'noxus', champ: 'darius' | null }
 *
 * Keeping this file pure is what lets the same rules run inside a web page
 * today and inside an Electron/Steam build later without a rewrite.
 */
(function (LOL) {
  'use strict';

  const C = LOL.CONFIG;

  function randInt(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[randInt(arr.length)]; }

  /* Rotate a square matrix clockwise. */
  function rotateCW(m) {
    const n = m.length;
    const out = [];
    for (let y = 0; y < n; y++) {
      out.push([]);
      for (let x = 0; x < n; x++) out[y].push(m[n - 1 - x][y]);
    }
    return out;
  }

  function rotateCCW(m) { return rotateCW(rotateCW(rotateCW(m))); }

  /* ------------------------------------------------------------------ */
  /* Piece generation                                                    */
  /* ------------------------------------------------------------------ */

  let runRegion = null;
  let runLeft = 0;

  /* Champions mostly belong to the region currently falling. Picked purely at
     random they would usually be the wrong region for the current run, sit
     inert as dead weight, and never get to fire. */
  function pickChampionKey() {
    if (runRegion && Math.random() < C.CHAMPION_MATCHES_RUN) {
      const matching = LOL.CHAMPION_KEYS.filter(function (k) {
        return LOL.CHAMPIONS[k].region === runRegion;
      });
      if (matching.length) return pick(matching);
    }
    return pick(LOL.CHAMPION_KEYS);
  }

  function makeChampionPiece() {
    const key = pickChampionKey();
    const champ = LOL.CHAMPIONS[key];
    return {
      kind: 'champion',
      matrix: [[1]],
      cells: [[{ region: champ.region, champ: key }]], // parallel to matrix
      x: Math.floor(C.COLS / 2),
      y: 0
    };
  }

  /* (run state is declared above makeChampionPiece so both can use it) */
  /* Regions arrive in short runs rather than independently at random.
     Without this a pure row is unreachable: a row is 10 cells, a piece is 4,
     and with six regions shuffled freely you can never bank enough of one
     region to finish a row in it. Runs are what make the pure-row bonus a
     goal you can actually play towards. */
  function nextPieceRegion() {
    if (runLeft <= 0) {
      const previous = runRegion;
      do { runRegion = pick(LOL.REGION_KEYS); }
      while (LOL.REGION_KEYS.length > 1 && runRegion === previous);
      runLeft = C.REGION_RUN_MIN + randInt(C.REGION_RUN_MAX - C.REGION_RUN_MIN + 1);
    }
    runLeft--;
    return runRegion;
  }

  function resetRuns() { runRegion = null; runLeft = 0; }

  function makeTetromino() {
    const shapeKey = pick(LOL.SHAPE_KEYS);
    const matrix = LOL.SHAPES[shapeKey].map(function (r) { return r.slice(); });
    const primary = nextPieceRegion();

    /* At the default bias of 1.0 a piece is a single region, like classic
       Tetris colours. Lowering the bias mixes other regions in. */
    const cells = matrix.map(function (row) {
      return row.map(function (v) {
        if (!v) return null;
        const region = Math.random() < C.PRIMARY_REGION_BIAS ? primary : pick(LOL.REGION_KEYS);
        return { region: region, champ: null };
      });
    });

    return {
      kind: shapeKey,
      matrix: matrix,
      cells: cells,
      x: Math.floor((C.COLS - matrix.length) / 2),
      y: 0
    };
  }

  function makePiece() {
    return Math.random() < C.CHAMPION_CHANCE ? makeChampionPiece() : makeTetromino();
  }

  function rotatePiece(piece, dir) {
    const rot = dir > 0 ? rotateCW : rotateCCW;
    return {
      kind: piece.kind,
      matrix: rot(piece.matrix),
      cells: rot(piece.cells),
      x: piece.x,
      y: piece.y
    };
  }

  /* ------------------------------------------------------------------ */
  /* Board                                                               */
  /* ------------------------------------------------------------------ */

  function Board() {
    this.cols = C.COLS;
    this.rows = C.ROWS;
    this.grid = new Array(this.cols * this.rows).fill(null);
  }

  Board.prototype.idx = function (x, y) { return y * this.cols + x; };

  Board.prototype.inside = function (x, y) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  };

  Board.prototype.get = function (x, y) {
    return this.inside(x, y) ? this.grid[this.idx(x, y)] : undefined;
  };

  Board.prototype.set = function (x, y, cell) {
    if (this.inside(x, y)) this.grid[this.idx(x, y)] = cell;
  };

  Board.prototype.collides = function (piece, px, py) {
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        const bx = px + x;
        const by = py + y;
        if (bx < 0 || bx >= this.cols || by >= this.rows) return true;
        if (by < 0) continue;             // above the ceiling is legal while falling
        if (this.grid[this.idx(bx, by)]) return true;
      }
    }
    return false;
  };

  Board.prototype.lock = function (piece) {
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        this.set(piece.x + x, piece.y + y, piece.cells[y][x]);
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Clearing — classic Tetris rows, with a bonus for single-region rows  */
  /* ------------------------------------------------------------------ */

  Board.prototype.rowIsFull = function (y) {
    for (let x = 0; x < this.cols; x++) {
      if (!this.grid[this.idx(x, y)]) return false;
    }
    return true;
  };

  /* The region key if every block in the row shares one, otherwise null.
     Only meaningful for a full row. */
  Board.prototype.rowRegion = function (y) {
    const first = this.grid[this.idx(0, y)];
    if (!first) return null;
    for (let x = 1; x < this.cols; x++) {
      const cell = this.grid[this.idx(x, y)];
      if (!cell || cell.region !== first.region) return null;
    }
    return first.region;
  };

  /* Every completely filled row, top to bottom, tagged with its pure region. */
  Board.prototype.fullRows = function () {
    const out = [];
    for (let y = 0; y < this.rows; y++) {
      if (this.rowIsFull(y)) out.push({ y: y, region: this.rowRegion(y) });
    }
    return out;
  };

  Board.prototype.remove = function (indices) {
    const self = this;
    indices.forEach(function (i) { self.grid[i] = null; });
  };

  Board.prototype.removeRows = function (rows) {
    const self = this;
    rows.forEach(function (r) {
      for (let x = 0; x < self.cols; x++) self.grid[self.idx(x, r.y)] = null;
    });
  };

  /* Match-3 style gravity: each column compacts downward. Champion abilities
     punch holes in the middle of the stack, so blocks have to fall into them
     rather than whole rows shifting. For a plain row clear this gives exactly
     the same result as classic Tetris row shifting. */
  Board.prototype.applyGravity = function () {
    let moved = false;
    for (let x = 0; x < this.cols; x++) {
      let write = this.rows - 1;
      for (let y = this.rows - 1; y >= 0; y--) {
        const cell = this.grid[this.idx(x, y)];
        if (!cell) continue;
        if (write !== y) {
          this.grid[this.idx(x, write)] = cell;
          this.grid[this.idx(x, y)] = null;
          moved = true;
        }
        write--;
      }
    }
    return moved;
  };

  /* Where would this piece land if hard-dropped? */
  Board.prototype.dropY = function (piece) {
    let y = piece.y;
    while (!this.collides(piece, piece.x, y + 1)) y++;
    return y;
  };

  Board.prototype.champions = function () {
    const out = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.grid[this.idx(x, y)];
        if (cell && cell.champ) out.push({ x: x, y: y, key: cell.champ });
      }
    }
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* Champion activation — contact with their own region                 */
  /* ------------------------------------------------------------------ */

  const ORTHOGONAL = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const DIAGONAL = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

  /* Is this champion touching a block of its own region? Another champion of
     the same region counts — two Noxians meeting should set each other off. */
  Board.prototype.championHasContact = function (x, y) {
    const cell = this.get(x, y);
    if (!cell || !cell.champ) return false;

    const dirs = C.CHAMPION_CONTACT_DIAGONAL ? ORTHOGONAL.concat(DIAGONAL) : ORTHOGONAL;
    for (let i = 0; i < dirs.length; i++) {
      const n = this.get(x + dirs[i][0], y + dirs[i][1]);
      if (n && n.region === cell.region) return true;
    }
    return false;
  };

  /* The first champion currently in contact with its own region, or null.
     Callers fire them one at a time so each ability's fallout is resolved
     before the next champion is considered. */
  Board.prototype.nextTriggeredChampion = function () {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.grid[this.idx(x, y)];
        if (cell && cell.champ && this.championHasContact(x, y)) {
          return { x: x, y: y, key: cell.champ };
        }
      }
    }
    return null;
  };

  LOL.Engine = {
    Board: Board,
    makePiece: makePiece,
    makeTetromino: makeTetromino,
    makeChampionPiece: makeChampionPiece,
    rotatePiece: rotatePiece,
    resetRuns: resetRuns
  };

})(window.LOL);
