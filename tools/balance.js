/*
 * balance.js — plays the game with a greedy strategy to answer two questions:
 *   1. can an attentive player survive?
 *   2. are pure (single-region) rows actually achievable, or just decoration?
 *
 *   node tools/balance.js
 */
global.window = global;
const path = require('path');
require(path.join(__dirname, '../src/config.js'));
require(path.join(__dirname, '../src/engine.js'));
require(path.join(__dirname, '../src/abilities.js'));

const LOL = global.LOL;
const E = LOL.Engine;
const C = LOL.CONFIG;

function cloneBoard(b) {
  const c = new E.Board();
  c.grid = b.grid.map(function (cell) { return cell ? { region: cell.region, champ: cell.champ } : null; });
  return c;
}

function heightOf(b) {
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) if (b.get(x, y)) return b.rows - y;
  }
  return 0;
}

/* How close the board is to having pure rows: counts filled cells in rows
   where every filled cell so far shares one region. A human chasing the bonus
   plays for this; a 1-ply greedy that only scores *completed* pure rows never
   builds towards one, and would tell us the bonus is unreachable when it is
   really just un-plannable in one ply. */
function purityProgress(b) {
  let score = 0;
  for (let y = 0; y < b.rows; y++) {
    let region = null, filled = 0, mixed = false;
    for (let x = 0; x < b.cols; x++) {
      const cell = b.get(x, y);
      if (!cell) continue;
      filled++;
      if (region === null) region = cell.region;
      else if (cell.region !== region) { mixed = true; break; }
    }
    if (!mixed && filled >= 4) score += filled * filled;
  }
  return score;
}

function holesOf(b) {
  let holes = 0;
  for (let x = 0; x < b.cols; x++) {
    let seen = false;
    for (let y = 0; y < b.rows; y++) {
      if (b.get(x, y)) seen = true;
      else if (seen) holes++;
    }
  }
  return holes;
}

/* Same order of operations as main.js: champions first, then rows. */
function resolve(board) {
  let rows = 0, pure = 0, abilities = 0, guard = 0;
  while (guard++ < 200) {
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
      rows += full.length;
      pure += full.filter(function (r) { return r.region; }).length;
      board.removeRows(full);
      board.applyGravity();
      continue;
    }
    break;
  }
  return { rows: rows, pure: pure, abilities: abilities };
}

/* Try every rotation and column; score the outcome. The pure-row weight is
   what makes this player chase single-region rows rather than just survive. */
function bestPlacement(board, piece, pureWeight) {
  let best = null;
  let candidate = piece;
  for (let rot = 0; rot < 4; rot++) {
    for (let x = -2; x < board.cols; x++) {
      const probe = { matrix: candidate.matrix, cells: candidate.cells, x: x, y: 0 };
      if (board.collides(probe, x, 0)) continue;
      const y = board.dropY(probe);
      const sim = cloneBoard(board);
      sim.lock({ matrix: candidate.matrix, cells: candidate.cells, x: x, y: y });
      const out = resolve(sim);
      const score = out.rows * 60
                  + out.pure * pureWeight
                  + (pureWeight ? purityProgress(sim) * 0.6 : 0)
                  + out.abilities * 20
                  - heightOf(sim) * 3
                  - holesOf(sim) * 8;
      if (!best || score > best.score) {
        best = { score: score, x: x, y: y, matrix: candidate.matrix, cells: candidate.cells };
      }
    }
    candidate = E.rotatePiece(candidate, 1);
  }
  return best;
}

function playGame(maxPieces, pureWeight) {
  const board = new E.Board();
  let pieces = 0, rows = 0, pure = 0, abilities = 0;
  while (pieces < maxPieces) {
    const piece = E.makePiece();
    if (board.collides(piece, piece.x, piece.y)) break; // topped out
    const place = bestPlacement(board, piece, pureWeight);
    if (!place) break;
    board.lock({ matrix: place.matrix, cells: place.cells, x: place.x, y: place.y });
    pieces++;
    const out = resolve(board);
    rows += out.rows; pure += out.pure; abilities += out.abilities;
  }
  return { pieces: pieces, rows: rows, pure: pure, abilities: abilities, height: heightOf(board) };
}

function report(label, games, maxPieces, pureWeight) {
  const runs = [];
  for (let i = 0; i < games; i++) runs.push(playGame(maxPieces, pureWeight));
  const avg = function (f) { return runs.reduce(function (s, r) { return s + f(r); }, 0) / runs.length; };
  const survived = runs.filter(function (r) { return r.pieces >= maxPieces; }).length;
  console.log(label);
  console.log('  pieces survived: ' + avg(function (r) { return r.pieces; }).toFixed(0) +
              ' of ' + maxPieces + '   reached the end: ' + survived + '/' + games);
  console.log('  rows cleared:    ' + avg(function (r) { return r.rows; }).toFixed(1) +
              '   of which pure: ' + avg(function (r) { return r.pure; }).toFixed(1) +
              ' (' + (100 * avg(function (r) { return r.pure; }) /
                      Math.max(avg(function (r) { return r.rows; }), 0.001)).toFixed(0) + '%)');
  console.log('  abilities fired: ' + avg(function (r) { return r.abilities; }).toFixed(1) + '\n');
}

console.log('champion spawn rate ' + (C.CHAMPION_CHANCE * 100).toFixed(0) +
            '%, piece region bias ' + C.PRIMARY_REGION_BIAS + '\n');
report('A player who only wants to survive (ignores purity)', 12, 300, 0);
report('A player chasing pure rows', 12, 300, 300);
