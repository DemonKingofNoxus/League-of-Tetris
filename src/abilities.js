/*
 * abilities.js — champion effects.
 *
 * A champion fires automatically the moment it touches a block of its own
 * region (see Board.championHasContact). There is no clicking. A champion
 * that never meets its region simply settles and stays there.
 *
 * Each ability is a function (board, x, y) -> { destroy: [indices], bonus? }
 * where (x, y) is the champion's own cell. The champion always spends itself,
 * so the caller adds its own index to the destroy list.
 *
 * Adding a champion = an entry in config.js + one function here.
 */
(function (LOL) {
  'use strict';

  const C = LOL.CONFIG;

  /* Collect occupied cells matching a predicate over the whole board. */
  function collect(board, fn) {
    const out = [];
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        if (board.get(x, y) && fn(x, y)) out.push(board.idx(x, y));
      }
    }
    return out;
  }

  const ABILITIES = {

    /* Darius — Noxian Guillotine: straight down. */
    column_below: function (board, x, y) {
      const destroy = [];
      for (let yy = y + 1; yy < board.rows; yy++) {
        if (board.get(x, yy)) destroy.push(board.idx(x, yy));
      }
      return { destroy: destroy };
    },

    /* Kayle — Divine Judgment: a filled circle centred on her. */
    circle: function (board, x, y) {
      const r = C.KAYLE_RADIUS;
      const r2 = r * r;
      return {
        destroy: collect(board, function (xx, yy) {
          const dx = xx - x, dy = yy - y;
          return dx * dx + dy * dy <= r2;
        })
      };
    },

    /* Gwen — Snip Snip!: a cone widening downward from her. */
    cone: function (board, x, y) {
      const destroy = [];
      for (let d = 1; d <= C.GWEN_CONE_DEPTH; d++) {
        const yy = y + d;
        if (yy >= board.rows) break;
        for (let dx = -d; dx <= d; dx++) {
          const xx = x + dx;
          if (board.inside(xx, yy) && board.get(xx, yy)) destroy.push(board.idx(xx, yy));
        }
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

    /* Sivir — Boomerang Blade: every block of her own region, board-wide. */
    region_nuke: function (board, x, y) {
      const self = board.get(x, y);
      if (!self) return { destroy: [] };
      return {
        destroy: collect(board, function (xx, yy) {
          return board.get(xx, yy).region === self.region;
        })
      };
    },

    /* Twitch — Spray and Pray: a burst at random occupied blocks. */
    random_shots: function (board, x, y) {
      const own = board.idx(x, y);
      const targets = collect(board, function (xx, yy) {
        return board.idx(xx, yy) !== own;
      });
      /* Partial Fisher-Yates: shuffle only as many as we need. */
      const shots = Math.min(C.TWITCH_SHOTS, targets.length);
      for (let i = 0; i < shots; i++) {
        const j = i + Math.floor(Math.random() * (targets.length - i));
        const t = targets[i]; targets[i] = targets[j]; targets[j] = t;
      }
      return { destroy: targets.slice(0, shots) };
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
      return { destroy: collect(board, function () { return true; }) };
    },

    /* Pyke — Death from Below: an X through both diagonals, full length. */
    cross_x: function (board, x, y) {
      const destroy = [];
      const dirs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      dirs.forEach(function (d) {
        let xx = x + d[0], yy = y + d[1];
        while (board.inside(xx, yy)) {
          if (board.get(xx, yy)) destroy.push(board.idx(xx, yy));
          xx += d[0];
          yy += d[1];
        }
      });
      return { destroy: destroy };
    },

    /* Teemo — Noxious Trap: shrooms landing on random 2x2 patches. */
    shrooms: function (board, x, y) {
      const hits = {};
      for (let s = 0; s < C.TEEMO_SHROOMS; s++) {
        const ox = Math.floor(Math.random() * (board.cols - 1));
        const oy = Math.floor(Math.random() * (board.rows - 1));
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const xx = ox + dx, yy = oy + dy;
            if (board.inside(xx, yy) && board.get(xx, yy)) hits[board.idx(xx, yy)] = true;
          }
        }
      }
      return { destroy: Object.keys(hits).map(Number) };
    },

    /* Qiyana — Supreme Display of Talent: a hollow O, the ring only. */
    ring: function (board, x, y) {
      const r = C.QIYANA_RING;
      const inner = (r - 1) * (r - 1);
      const outer = (r + 0.5) * (r + 0.5);
      return {
        destroy: collect(board, function (xx, yy) {
          const dx = xx - x, dy = yy - y;
          const d2 = dx * dx + dy * dy;
          return d2 > inner && d2 <= outer;
        })
      };
    },

    /* Aurelion Sol — Falling Star: the board, plus a large flat bonus. */
    supernova: function (board) {
      return {
        destroy: collect(board, function () { return true; }),
        bonus: C.AURELION_BONUS
      };
    },

    /*
     * Caitlyn — Ace in the Hole: destroys every champion block on the board
     * and sets off each of their abilities.
     *
     * The other champions' effects are all evaluated against the board as it
     * stands right now, before anything is removed. Resolving them one at a
     * time instead would let the first blast delete the champions queued
     * behind it, so most of the chain would silently do nothing.
     */
    detonate_champions: function (board, x, y) {
      const own = board.idx(x, y);
      const hits = {};
      const fired = [];
      let bonus = 0;

      board.champions().forEach(function (c) {
        const index = board.idx(c.x, c.y);
        hits[index] = true;               // the champion block itself goes
        if (index === own) return;        // Caitlyn does not re-trigger herself

        const champ = LOL.CHAMPIONS[c.key];
        const fn = champ && ABILITIES[champ.ability];
        if (!fn || champ.ability === 'detonate_champions') return;

        const result = fn(board, c.x, c.y) || {};
        (result.destroy || []).forEach(function (i) { hits[i] = true; });
        bonus += result.bonus || 0;
        fired.push(champ.name);
      });

      return {
        destroy: Object.keys(hits).map(Number),
        bonus: bonus,
        chained: fired
      };
    }
  };

  /*
   * Fire the champion sitting at (x, y). Returns null if there isn't one, or
   * { champ, destroy, bonus, chained } describing what happened.
   */
  function trigger(board, x, y) {
    const cell = board.get(x, y);
    if (!cell || !cell.champ) return null;

    const champ = LOL.CHAMPIONS[cell.champ];
    const fn = champ && ABILITIES[champ.ability];
    if (!fn) return null;

    const result = fn(board, x, y) || {};
    const destroy = result.destroy || [];
    const own = board.idx(x, y);
    if (destroy.indexOf(own) === -1) destroy.push(own); // the champion spends itself

    return {
      champ: champ,
      destroy: destroy,
      bonus: result.bonus || 0,
      chained: result.chained || []
    };
  }

  LOL.Abilities = { table: ABILITIES, trigger: trigger };

})(window.LOL);
