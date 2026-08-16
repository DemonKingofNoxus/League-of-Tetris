/*
 * gold.js — how much gold an event is worth. Pure arithmetic, no state.
 *
 * The rule is that gold only comes from playing the game's own systems, not
 * from surviving: an ordinary mixed row pays score but no gold. Champion
 * abilities and single-region rows are what earn.
 */
(function (LOL) {
  'use strict';

  const C = LOL.CONFIG;

  /* Chains and levels each add a fraction on top, so a late-game chain is
     worth more than the same blocks cleared cold at level 1. */
  function multiplier(chain, level) {
    const chainPart = 1 + Math.max(0, (chain || 1) - 1) * C.GOLD_CHAIN_BONUS;
    const levelPart = 1 + Math.max(0, (level || 1) - 1) * C.GOLD_LEVEL_BONUS;
    return chainPart * levelPart;
  }

  /* A champion ability that destroyed `blocks` blocks. */
  function forAbility(blocks, chain, level) {
    if (!blocks) return 0;
    return Math.round(blocks * C.GOLD_PER_ABILITY_BLOCK * multiplier(chain, level));
  }

  /*
   * A batch of cleared rows. `rows` is what Board.fullRows() returns, so each
   * entry carries its pure region or null.
   */
  function forRows(rows, cols, chain, level) {
    if (!rows || !rows.length) return 0;
    let base = 0;
    rows.forEach(function (r) {
      base += cols * (r.region ? C.GOLD_PURE_ROW_PER_BLOCK : C.GOLD_PER_ROW_BLOCK);
    });
    return Math.round(base * multiplier(chain, level));
  }

  LOL.Gold = {
    multiplier: multiplier,
    forAbility: forAbility,
    forRows: forRows
  };

})(window.LOL);
