/*
 * config.js — everything themeable lives here.
 *
 * The engine never hardcodes a region or a champion name. If you want to
 * reskin this game to your own IP later (which you must, before selling it
 * anywhere), you only rewrite this file and swap the files in /assets.
 */
window.LOL = window.LOL || {};

LOL.CONFIG = {

  /* ---------- board ---------- */
  COLS: 10,
  ROWS: 20,
  CELL: 32,               // px per cell in the canvas backing store

  /* ---------- clearing rules ---------- */
  /* Classic Tetris: a completely filled row clears. If every block in that
     row is the same region, the row is "pure" and pays PURE_ROW_MULTIPLIER
     times as much. */
  PURE_ROW_MULTIPLIER: 5,

  /* ---------- piece generation ---------- */
  /* 1.0 = every cell of a piece is the same region, like classic Tetris
     colours. Lower it to mix regions within a piece (harder, messier). */
  PRIMARY_REGION_BIAS: 1.0,
  CHAMPION_CHANCE: 0.12,  // chance the next piece is a 1x1 champion instead
  /* Consecutive pieces share a region for this many turns before the
     generator switches. This is what makes a pure row reachable. */
  CHAMPION_MATCHES_RUN: 0.75, // chance a champion matches the region now falling
  REGION_RUN_MIN: 12,
  REGION_RUN_MAX: 20,

  /* ---------- champion activation ---------- */
  /* Champions fire automatically once they touch a block of their own
     region (up/down/left/right). No clicking. */
  CHAMPION_CONTACT_DIAGONAL: false, // count diagonal neighbours as contact too
  TWITCH_SHOTS: 8,        // how many random blocks Twitch destroys

  /* ---------- timing (ms) ---------- */
  DROP_BASE: 800,         // fall interval at level 1
  DROP_MIN: 90,           // fastest it ever gets
  LOCK_DELAY: 380,        // grace period once a piece touches down
  FLASH_MS: 150,          // how long doomed blocks glow before vanishing

  /* ---------- scoring ---------- */
  ROWS_PER_LEVEL: 10,
  SCORE_ROW: 100,                       // one cleared row
  MULTI_ROW: [0, 1, 1.5, 2, 3],         // bonus for clearing 1-4 rows at once
  SCORE_PER_CELL: 10,                   // blocks destroyed by an ability
  SCORE_SOFT_DROP: 1,
  SCORE_HARD_DROP: 2,
  SCORE_ABILITY: 25,

  /* ---------- palette (used when art is missing) ---------- */
  UI: {
    bg:      '#0a0e14',
    grid:    '#161d29',
    gridLine:'#1e2836',
    ghost:   'rgba(255,255,255,0.10)',
    flash:   '#ffffff'
  }
};

/*
 * REGIONS
 * `color` is the tile background — deliberately muted rather than fully
 * saturated, so six of them on screen at once stay easy on the eyes and the
 * gold crest keeps its contrast.
 * `art` is optional: if the file is missing the renderer falls back to a flat
 * tile with the `short` label, and the game still plays.
 */
LOL.REGIONS = {
  noxus:    { name: 'Noxus',    short: 'NO', color: '#a8474a', art: 'assets/regions/noxus.png' },
  void:     { name: 'Void',     short: 'VO', color: '#8a63ad', art: 'assets/regions/void.png' },
  freljord: { name: 'Freljord', short: 'FR', color: '#5b90bd', art: 'assets/regions/freljord.png' },
  zaun:     { name: 'Zaun',     short: 'ZA', color: '#67a15c', art: 'assets/regions/zaun.png' },
  ionia:    { name: 'Ionia',    short: 'IO', color: '#c47ba0', art: 'assets/regions/ionia.png' },
  shurima:  { name: 'Shurima',  short: 'SH', color: '#9a7830', art: 'assets/regions/shurima.png' }
};

/* The gold used for region crests. Kept here so the art pipeline and the
   fallback rendering agree on one value. */
LOL.GOLD = '#f2dfa8';

/*
 * CHAMPIONS
 * A champion belongs to a region and fires automatically the moment it
 * touches a block of that region.
 */
LOL.CHAMPIONS = {
  sivir: {
    name: 'Sivir', region: 'shurima', ability: 'region_nuke',
    abilityName: 'Boomerang Blade',
    desc: 'Destroys every Shurima block on the board.',
    art: 'assets/champions/sivir.png'
  },
  twitch: {
    name: 'Twitch', region: 'zaun', ability: 'random_shots',
    abilityName: 'Spray and Pray',
    desc: 'Shoots ' + LOL.CONFIG.TWITCH_SHOTS + ' random blocks anywhere on the board.',
    art: 'assets/champions/twitch.png'
  },
  darius: {
    name: 'Darius', region: 'noxus', ability: 'column_below',
    abilityName: 'Noxian Guillotine',
    desc: 'Executes every block in a straight line below him.',
    art: 'assets/champions/darius.png'
  },
  ahri: {
    name: 'Ahri', region: 'ionia', ability: 'full_row',
    abilityName: 'Orb of Deception',
    desc: 'Destroys her entire row horizontally.',
    art: 'assets/champions/ahri.png'
  },
  kaisa: {
    name: "Kai'Sa", region: 'void', ability: 'blast_3x3',
    abilityName: 'Icathian Rain',
    desc: 'Missiles the 3×3 area surrounding her.',
    art: 'assets/champions/kaisa.png'
  },
  sejuani: {
    name: 'Sejuani', region: 'freljord', ability: 'board_wipe',
    abilityName: 'Glacial Prison',
    desc: 'Her bola shatters every block on the board.',
    art: 'assets/champions/sejuani.png'
  }
};

/* Tetromino shapes. 1 = filled. Rotation is computed, not stored. */
LOL.SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]]
};

LOL.REGION_KEYS = Object.keys(LOL.REGIONS);
LOL.CHAMPION_KEYS = Object.keys(LOL.CHAMPIONS);
LOL.SHAPE_KEYS = Object.keys(LOL.SHAPES);
