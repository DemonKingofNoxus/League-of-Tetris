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
  const T = LOL.Tuning;   // level-aware view of the CONFIG numbers

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

  /*
   * Only the regions in play for the current level can appear. One of them is
   * "featured" and takes FEATURED_SHARE of the pieces; the rest are spread
   * over the others. That is a deliberate middle ground: drawing uniformly
   * makes a pure row unreachable (a row is 12 cells and a piece is 4), while
   * emitting one region at a time in long runs makes the board monotonous.
   */
  let active = LOL.REGION_KEYS.slice();
  let featured = null;
  let featureLeft = 0;

  function setActiveRegions(keys) {
    active = (keys && keys.length) ? keys.slice() : LOL.REGION_KEYS.slice();
    /* Keep the featured region only if it survived into the new pool. */
    if (active.indexOf(featured) === -1) { featured = null; featureLeft = 0; }
  }

  function getActiveRegions() { return active.slice(); }

  function rotateFeature() {
    const previous = featured;
    if (active.length > 1) {
      do { featured = pick(active); } while (featured === previous);
    } else {
      featured = active[0];
    }
    const lo = T.value('FEATURE_ROTATE_MIN');
    const hi = T.value('FEATURE_ROTATE_MAX');
    featureLeft = lo + randInt(Math.max(1, hi - lo + 1));
  }

  function getFeatured() {
    if (featured === null) rotateFeature();
    return featured;
  }

  function nextPieceRegion() {
    if (featureLeft <= 0) rotateFeature();
    featureLeft--;

    if (Math.random() < T.value('FEATURED_SHARE')) return featured;

    /* Anything except the featured region, so the mix stays visible. */
    const others = active.filter(function (k) { return k !== featured; });
    return others.length ? pick(others) : featured;
  }

  function resetGenerator() { featured = null; featureLeft = 0; }

  /* Champions only exist for regions in play, and mostly match the region
     currently falling — otherwise they land nowhere near their own colour and
     sit as dead weight for the rest of the game. Within that, each champion's
     own weight decides how often it is the one that shows up. */
  function weightedPick(keys) {
    let total = 0;
    for (let i = 0; i < keys.length; i++) total += T.championWeight(keys[i]);
    if (total <= 0) return null;          // every champion in play is disabled

    let roll = Math.random() * total;
    for (let i = 0; i < keys.length; i++) {
      roll -= T.championWeight(keys[i]);
      if (roll < 0) return keys[i];
    }
    return keys[keys.length - 1];         // floating point safety net
  }

  function championsInPlay() {
    return active
      .map(function (r) { return LOL.CHAMPION_BY_REGION[r]; })
      .filter(Boolean);
  }

  function pickChampionKey() {
    const available = championsInPlay();
    if (!available.length) return null;

    if (Math.random() < T.value('CHAMPION_MATCHES_FEATURE')) {
      const match = LOL.CHAMPION_BY_REGION[getFeatured()];
      /* A champion on weight 0 is switched off, so it must not be forced in
         through the featured-region shortcut either. */
      if (match && T.championWeight(match) > 0) return match;
    }
    return weightedPick(available);
  }

  function makeChampionPiece() {
    const key = pickChampionKey();
    if (!key) return makeTetromino();   // nothing eligible: fall back to a shape
    const champ = LOL.CHAMPIONS[key];
    return {
      kind: 'champion',
      matrix: [[1]],
      cells: [[{ region: champ.region, champ: key }]], // parallel to matrix
      x: Math.floor(C.COLS / 2),
      y: 0
    };
  }

  function makeTetromino() {
    const shapeKey = pick(LOL.SHAPE_KEYS);
    const matrix = LOL.SHAPES[shapeKey].map(function (r) { return r.slice(); });
    const region = nextPieceRegion();

    /* A piece is a single region, like classic Tetris colours. */
    const cells = matrix.map(function (row) {
      return row.map(function (v) {
        return v ? { region: region, champ: null } : null;
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
    return Math.random() < T.value('CHAMPION_CHANCE') ? makeChampionPiece() : makeTetromino();
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

  /* The region key if every block in the row shares one, otherwise null. */
  Board.prototype.rowRegion = function (y) {
    const first = this.grid[this.idx(0, y)];
    if (!first) return null;
    for (let x = 1; x < this.cols; x++) {
      const cell = this.grid[this.idx(x, y)];
      if (!cell || cell.region !== first.region) return null;
    }
    return first.region;
  };

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
    setActiveRegions: setActiveRegions,
    getActiveRegions: getActiveRegions,
    championsInPlay: championsInPlay,
    getFeatured: getFeatured,
    resetGenerator: resetGenerator
  };

})(window.LOL);
