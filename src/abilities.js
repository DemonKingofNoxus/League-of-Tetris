/*
 * abilities.js — champion effects.
 *
 * A champion fires automatically the moment it touches a block of its own
 * region (see Board.championHasContact). There is no clicking.
 *
 * Each ability is a function (board, x, y) -> { destroy: [indices] }
 * where (x, y) is the champion's own cell. The champion always spends itself,
 * so the caller adds its own index to the destroy list.
 *
 * Adding a champion = an entry in config.js + one function here.
 */
(function (LOL) {
  'use strict';

  const C = LOL.CONFIG;

  const ABILITIES = {

    /* Sivir — Boomerang Blade: every block of her own region, board-wide. */
    region_nuke: function (board, x, y) {
      const self = board.get(x, y);
      if (!self) return { destroy: [] };
      const destroy = [];
      for (let yy = 0; yy < board.rows; yy++) {
        for (let xx = 0; xx < board.cols; xx++) {
          const cell = board.get(xx, yy);
          if (cell && cell.region === self.region) destroy.push(board.idx(xx, yy));
        }
      }
      return { destroy: destroy };
    },

    /* Twitch — Spray and Pray: a burst of shots at random occupied blocks. */
    random_shots: function (board, x, y) {
      const own = board.idx(x, y);
      const targets = [];
      for (let yy = 0; yy < board.rows; yy++) {
        for (let xx = 0; xx < board.cols; xx++) {
          const i = board.idx(xx, yy);
          if (i !== own && board.get(xx, yy)) targets.push(i);
        }
      }
      /* Partial Fisher-Yates: shuffle only as many as we need. */
      const shots = Math.min(C.TWITCH_SHOTS, targets.length);
      for (let i = 0; i < shots; i++) {
        const j = i + Math.floor(Math.random() * (targets.length - i));
        const t = targets[i]; targets[i] = targets[j]; targets[j] = t;
      }
      return { destroy: targets.slice(0, shots) };
    },

    /* Darius — Noxian Guillotine: straight down. */
    column_below: function (board, x, y) {
      const destroy = [];
      for (let yy = y + 1; yy < board.rows; yy++) {
        if (board.get(x, yy)) destroy.push(board.idx(x, yy));
      }
      return { destroy: destroy };
    },

    /* Ahri — Orb of Deception: her whole row. */
    full_row: function (board, x, y) {
      const destroy = [];
      for (let xx = 0; xx < board.cols; xx++) {
        if (board.get(xx, y)) destroy.push(board.idx(xx, y));
      }
      return { destroy: destroy };
    },

    /* Kai'Sa — Icathian Rain: the 3x3 around her. */
    blast_3x3: function (board, x, y) {
      const destroy = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (board.inside(xx, yy) && board.get(xx, yy)) destroy.push(board.idx(xx, yy));
        }
      }
      return { destroy: destroy };
    },

    /* Sejuani — Glacial Prison: the entire board. */
    board_wipe: function (board) {
      const destroy = [];
      for (let yy = 0; yy < board.rows; yy++) {
        for (let xx = 0; xx < board.cols; xx++) {
          if (board.get(xx, yy)) destroy.push(board.idx(xx, yy));
        }
      }
      return { destroy: destroy };
    }
  };

  /*
   * Fire the champion sitting at (x, y). Returns null if there isn't one, or
   * { champ, destroy } describing what happened.
   */
  function trigger(board, x, y) {
    const cell = board.get(x, y);
    if (!cell || !cell.champ) return null;

    const champ = LOL.CHAMPIONS[cell.champ];
    const fn = champ && ABILITIES[champ.ability];
    if (!fn) return null;

    const result = fn(board, x, y);
    const destroy = result.destroy || [];
    const own = board.idx(x, y);
    if (destroy.indexOf(own) === -1) destroy.push(own); // the champion spends itself

    return { champ: champ, destroy: destroy };
  }

  LOL.Abilities = { table: ABILITIES, trigger: trigger };

})(window.LOL);
