/*
 * tuning.js — resolves "what is this number at level N?".
 *
 * Three layers, each overriding the one before it:
 *
 *   1. the base value in LOL.CONFIG
 *   2. LOL.CONFIG.LEVEL_TUNING           — per level, for any CONFIG key
 *   3. LOL.CONFIG.LEVEL_CHAMPION_WEIGHTS — per level, per champion spawn weight
 *
 * Level entries CASCADE: an override set at level 3 stays in force at levels
 * 4, 5, 6... until some later level overrides that same key again. So you only
 * write the levels where something actually changes.
 *
 *   LEVEL_TUNING: {
 *     1: { CHAMPION_CHANCE: 0.30 },   // levels 1-4 use 0.30
 *     5: { CHAMPION_CHANCE: 0.22 },   // levels 5+ use 0.22
 *   }
 */
(function (LOL) {
  'use strict';

  const C = LOL.CONFIG;

  let level = 1;
  let values = null;      // resolved CONFIG overrides for `level`
  let weights = null;     // resolved champion weights for `level`

  /* Merge every entry whose level is <= lvl, lowest first, so later levels win. */
  function mergeUpTo(table, lvl) {
    const out = {};
    if (!table) return out;
    Object.keys(table)
      .map(Number)
      .filter(function (k) { return !isNaN(k) && k <= lvl; })
      .sort(function (a, b) { return a - b; })
      .forEach(function (k) {
        const entry = table[k];
        Object.keys(entry).forEach(function (key) { out[key] = entry[key]; });
      });
    return out;
  }

  function recompute() {
    values = mergeUpTo(C.LEVEL_TUNING, level);
    weights = mergeUpTo(C.LEVEL_CHAMPION_WEIGHTS, level);
  }

  function setLevel(n) {
    level = Math.max(1, n | 0);
    recompute();
  }

  function getLevel() { return level; }

  /* The effective value of a CONFIG key right now. */
  function value(key) {
    if (!values) recompute();
    return values[key] !== undefined ? values[key] : C[key];
  }

  /*
   * Spawn weight for one champion. Relative, not a percentage: a champion at
   * weight 2 is twice as likely as one at weight 1 among the champions
   * currently in play. Weight 0 means "never spawn".
   */
  function championWeight(key) {
    if (!weights) recompute();
    if (weights[key] !== undefined) return Math.max(0, weights[key]);
    const champ = LOL.CHAMPIONS[key];
    const own = champ && champ.weight;
    return own === undefined ? 1 : Math.max(0, own);
  }

  /* What each champion's spawn chance actually works out to, given the
     champions currently in play. Used by the UI and by tools/rates.js. */
  function championShares(availableKeys) {
    const total = availableKeys.reduce(function (sum, k) {
      return sum + championWeight(k);
    }, 0);
    const out = {};
    availableKeys.forEach(function (k) {
      out[k] = total > 0 ? championWeight(k) / total : 0;
    });
    return out;
  }

  LOL.Tuning = {
    setLevel: setLevel,
    getLevel: getLevel,
    value: value,
    championWeight: championWeight,
    championShares: championShares
  };

})(window.LOL);
