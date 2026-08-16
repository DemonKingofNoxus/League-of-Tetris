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

  function makeChampionPiece() {
    const key = pick(LOL.CHAMPION_KEYS);
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
    const primary = pick(LOL.REGION_KEYS);

    /* Each filled cell takes the piece's primary region most of the time and a
       random other region the rest, so pieces are readable but still mixed
       enough that matching is a real decision. */
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

  /* Every index that should be destroyed right now. */
  Board.prototype.findMatches = function () {
    const hits = new Set();
    const self = this;

    function runOf(coords) {
      // coords: array of [x,y] along one line, in order
      let start = 0;
      while (start < coords.length) {
        const first = self.get(coords[start][0], coords[start][1]);
        if (!first) { start++; continue; }
        let end = start + 1;
        while (end < coords.length) {
          const next = self.get(coords[end][0], coords[end][1]);
          if (!next || next.region !== first.region) break;
          end++;
        }
        if (end - start >= C.MATCH_MIN) {
          for (let i = start; i < end; i++) {
            const cell = self.get(coords[i][0], coords[i][1]);
            if (cell.champ && !C.CHAMPS_CLEARED_BY_MATCH) continue;
            hits.add(self.idx(coords[i][0], coords[i][1]));
          }
        }
        start = end;
      }
    }

    if (C.MATCH_HORIZONTAL) {
      for (let y = 0; y < this.rows; y++) {
        const line = [];
        for (let x = 0; x < this.cols; x++) line.push([x, y]);
        runOf(line);
      }
    }

    if (C.MATCH_VERTICAL) {
      for (let x = 0; x < this.cols; x++) {
        const line = [];
        for (let y = 0; y < this.rows; y++) line.push([x, y]);
        runOf(line);
      }
    }

    if (C.FULL_ROW_CLEARS) {
      for (let y = 0; y < this.rows; y++) {
        let full = true;
        for (let x = 0; x < this.cols; x++) {
          if (!this.grid[this.idx(x, y)]) { full = false; break; }
        }
        if (full) for (let x = 0; x < this.cols; x++) hits.add(this.idx(x, y));
      }
    }

    return hits;
  };

  Board.prototype.remove = function (indices) {
    const self = this;
    indices.forEach(function (i) { self.grid[i] = null; });
  };

  /* Match-3 style gravity: each column compacts downward. */
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

  LOL.Engine = {
    Board: Board,
    makePiece: makePiece,
    makeTetromino: makeTetromino,
    makeChampionPiece: makeChampionPiece,
    rotatePiece: rotatePiece
  };

})(window.LOL);
