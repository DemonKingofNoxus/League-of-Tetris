/*
 * abilities.js — champion click effects.
 *
 * Each ability is a function (board, x, y) -> { destroy: [indices], converted: n }
 * where (x, y) is the champion's own cell. The champion cell is always consumed
 * by its own ability; the caller adds it to the destroy list.
 *
 * Adding a champion = add an entry in config.js + one function here.
 */
(function (LOL) {
  'use strict';

  const ABILITIES = {

    /* Darius — everything in the column straight down. */
    column_below: function (board, x, y) {
      const destroy = [];
      for (let yy = y + 1; yy < board.rows; yy++) {
        if (board.get(x, yy)) destroy.push(board.idx(x, yy));
      }
      return { destroy: destroy };
    },

    /* Lux — the whole row she sits in. */
    full_row: function (board, x, y) {
      const destroy = [];
      for (let xx = 0; xx < board.cols; xx++) {
        if (board.get(xx, y)) destroy.push(board.idx(xx, y));
      }
      return { destroy: destroy };
    },

    /* Ziggs — 3x3 blast centred on him. */
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

    /* Ashe — destroys nothing, but converts her neighbours to her own region,
       which usually sets up a much bigger chain than a straight nuke. */
    convert_neighbours: function (board, x, y) {
      const self = board.get(x, y);
      const region = self ? self.region : LOL.CHAMPIONS.ashe.region;
      let converted = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx, yy = y + dy;
          const cell = board.get(xx, yy);
          if (cell && cell.region !== region) { cell.region = region; converted++; }
        }
      }
      return { destroy: [], converted: converted };
    },

    /* Yasuo — the two columns beside him, below his own row. */
    side_columns: function (board, x, y) {
      const destroy = [];
      [x - 1, x + 1].forEach(function (xx) {
        for (let yy = y + 1; yy < board.rows; yy++) {
          if (board.inside(xx, yy) && board.get(xx, yy)) destroy.push(board.idx(xx, yy));
        }
      });
      return { destroy: destroy };
    },

    /* Miss Fortune — reads the region directly beneath her and wipes every
       block of that region from the entire board. */
    region_nuke: function (board, x, y) {
      const below = board.get(x, y + 1);
      if (!below) return { destroy: [] };
      const region = below.region;
      const destroy = [];
      for (let yy = 0; yy < board.rows; yy++) {
        for (let xx = 0; xx < board.cols; xx++) {
          const cell = board.get(xx, yy);
          if (cell && cell.region === region) destroy.push(board.idx(xx, yy));
        }
      }
      return { destroy: destroy };
    }
  };

  /*
   * Fire the champion sitting at (x, y). Returns null if there isn't one, or
   * { destroy, converted, champ } describing what happened.
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

    return {
      champ: champ,
      destroy: destroy,
      converted: result.converted || 0
    };
  }

  LOL.Abilities = { table: ABILITIES, trigger: trigger };

})(window.LOL);
