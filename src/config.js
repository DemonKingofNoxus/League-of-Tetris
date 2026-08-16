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
  COLS: 12,
  ROWS: 20,
  CELL: 32,               // px per cell in the canvas backing store

  /* ---------- clearing rules ---------- */
  /* Classic Tetris: a completely filled row clears. If every block in that
     row is the same region, the row is "pure" and pays this much more. */
  PURE_ROW_MULTIPLIER: 5,

  /* ---------- piece generation ----------
     One region is "featured" at a time and gets FEATURED_SHARE of the pieces;
     the rest are drawn from the other regions in play. That keeps the board
     visibly mixed while still letting you bank enough of one region to finish
     a pure row. Raising FEATURED_SHARE towards 1.0 gives long single-region
     streaks; lowering it towards 1/regions makes pure rows near-impossible. */
  FEATURED_SHARE: 0.45,
  FEATURE_ROTATE_MIN: 8,  // pieces before the featured region changes
  FEATURE_ROTATE_MAX: 14,

  CHAMPION_CHANCE: 0.30,          // chance the next piece is a 1x1 champion
  CHAMPION_MATCHES_FEATURE: 0.50, // how often that champion suits the featured region

  /* ---------- champion activation ---------- */
  /* Champions fire automatically once they touch a block of their own
     region (up/down/left/right). If they never touch it, they just sit. */
  CHAMPION_CONTACT_DIAGONAL: false,

  /* ability tuning */
  TWITCH_SHOTS: 5,        // Twitch: random blocks hit
  TEEMO_SHROOMS: 3,       // Teemo: 2x2 blasts
  KAYLE_RADIUS: 2.6,      // Kayle: circle radius in cells
  GWEN_CONE_DEPTH: 5,     // Gwen: how far the cone reaches
  SEJUANI_BLASTS: 1,      // Sejuani: how many random 3x3 areas
  AURELION_BONUS: 2000,   // Aurelion Sol: flat bonus on top of the wipe

  /* ---------- levels ----------
     Level 1 features 3 random regions, level 2 adds a fourth, and so on until
     level 11 has all 13. Reaching a target promotes you; the game keeps going
     past level 11 so high scores stay open-ended. */
  LEVEL_REGIONS_START: 3,
  LEVEL_COUNT: 11,
  LEVEL_TARGETS: [
    2000, 6000, 13000, 24000, 40000,
    62000, 92000, 132000, 184000, 250000
  ],

  /* ---------- per-level tuning ----------
     Override any CONFIG key above, per level. Entries CASCADE: a value set at
     level 3 stays in force for 4, 5, 6... until a later level overrides that
     same key. Write only the levels where something actually changes.

     Everything here is optional — delete the whole table and the base values
     above are used at every level. */
  LEVEL_TUNING: {
    // 1: { CHAMPION_CHANCE: 0.30, FEATURED_SHARE: 0.45 },
    // 4: { CHAMPION_CHANCE: 0.26 },   // champions thin out as the pool grows
    // 8: { FEATURED_SHARE: 0.38, CHAMPION_MATCHES_FEATURE: 0.40 },
  },

  /* Per-champion spawn weight, per level. Same cascade. Weights are relative
     to the other champions in play, not percentages — weight 2 is twice as
     likely as weight 1, and weight 0 means that champion never spawns.
     The starting weight for each champion is its `weight` in LOL.CHAMPIONS. */
  LEVEL_CHAMPION_WEIGHTS: {
    // 1: { sejuani: 0.5, aurelionSol: 0 },  // hold the big ones back early
    // 6: { aurelionSol: 1 },                // let Aurelion Sol in from level 6
  },

  /* ---------- timing (ms) ---------- */
  DROP_BASE: 850,         // fall interval at level 1
  DROP_MIN: 90,           // fastest it ever gets
  DROP_FACTOR: 0.88,      // per level
  LOCK_DELAY: 400,        // grace period once a piece touches down
  FLASH_MS: 160,          // how long doomed blocks glow before vanishing

  /* ---------- scoring ---------- */
  SCORE_ROW: 100,                       // one cleared row
  MULTI_ROW: [0, 1, 1.5, 2, 3, 4],      // bonus for clearing 1-5 rows at once
  SCORE_PER_CELL: 10,                   // blocks destroyed by an ability
  SCORE_SOFT_DROP: 1,
  SCORE_HARD_DROP: 2,
  SCORE_ABILITY: 50,

  /* ---------- gold ----------
     Gold is earned only for things beyond ordinary Tetris: champion abilities
     landing, and rows that come out in a single region. Clearing a plain
     mixed row pays score but no gold, so gold measures how well you played
     the region and champion systems rather than how long you survived. */
  GOLD_PER_ABILITY_BLOCK: 1,   // per block a champion ability destroys
  GOLD_PURE_ROW_PER_BLOCK: 5,  // per block in a single-region row
  GOLD_PER_ROW_BLOCK: 0,       // per block in an ordinary mixed row
  GOLD_CHAIN_BONUS: 0.25,      // extra fraction per chain step beyond the first
  GOLD_LEVEL_BONUS: 0.05,      // extra fraction per level above 1

  /* ---------- high scores ---------- */
  HIGHSCORE_LIMIT: 8,     // local list, kept in memory only

  /* ---------- palette ---------- */
  UI: {
    grid:     '#0d1119',
    gridLine: 'rgba(150,175,210,0.055)',
    ghost:    'rgba(226,214,180,0.13)',
    flash:    '#fff6e0'
  }
};

/*
 * REGIONS
 * `color` is the tile face. They are deliberately deep and slightly desaturated
 * rather than primary, so thirteen of them on one board read as a set instead
 * of a paint box — and so the gold crest keeps its contrast on every one.
 */
LOL.REGIONS = {
  noxus:       { name: 'Noxus',        short: 'NOX', color: '#a4383c', art: 'assets/regions/noxus.png' },
  demacia:     { name: 'Demacia',      short: 'DEM', color: '#3d64b0', art: 'assets/regions/demacia.png' },
  shadowIsles: { name: 'Shadow Isles', short: 'SHI', color: '#2f7d70', art: 'assets/regions/shadowIsles.png' },
  ionia:       { name: 'Ionia',        short: 'ION', color: '#c9789f', art: 'assets/regions/ionia.png' },
  shurima:     { name: 'Shurima',      short: 'SHU', color: '#a8752a', art: 'assets/regions/shurima.png' },
  zaun:        { name: 'Zaun',         short: 'ZAU', color: '#7fa82c', art: 'assets/regions/zaun.png' },
  void:        { name: 'Void',         short: 'VOI', color: '#7b52a8', art: 'assets/regions/void.png' },
  freljord:    { name: 'Freljord',     short: 'FRE', color: '#5aa3cf', art: 'assets/regions/freljord.png' },
  bilgewater:  { name: 'Bilgewater',   short: 'BIL', color: '#c06437', art: 'assets/regions/bilgewater.png' },
  bandleCity:  { name: 'Bandle City',  short: 'BAN', color: '#c9a83f', art: 'assets/regions/bandleCity.png' },
  ixtal:       { name: 'Ixtal',        short: 'IXT', color: '#3d9a5c', art: 'assets/regions/ixtal.png' },
  targon:      { name: 'Targon',       short: 'TAR', color: '#8b7fd6', art: 'assets/regions/targon.png' },
  piltover:    { name: 'Piltover',     short: 'PIL', color: '#2f9c9c', art: 'assets/regions/piltover.png' }
};

/*
 * CHAMPIONS — one per region. A champion fires the moment it touches a block
 * of its own region; otherwise it settles and stays put like any other block.
 *
 * `weight` is that champion's spawn rate relative to the other champions in
 * play — 2 is twice as likely as 1, and 0 means it never spawns. It is a
 * weight rather than a percentage so you can change one champion without
 * having to rebalance the other twelve to keep the total at 100.
 * LEVEL_CHAMPION_WEIGHTS above can override any of these per level.
 */
LOL.CHAMPIONS = {
  darius: {
    name: 'Darius', region: 'noxus', ability: 'column_below',
    abilityName: 'Noxian Guillotine',
    desc: 'Executes every block in a straight line below him.',
    weight: 1,
    art: 'assets/champions/darius.png'
  },
  kayle: {
    name: 'Kayle', region: 'demacia', ability: 'circle',
    abilityName: 'Divine Judgment',
    desc: 'Destroys everything in a circle around her.',
    weight: 1,
    art: 'assets/champions/kayle.png'
  },
  gwen: {
    name: 'Gwen', region: 'shadowIsles', ability: 'cone',
    abilityName: 'Snip Snip!',
    desc: 'Destroys blocks in a widening cone below her.',
    weight: 1,
    art: 'assets/champions/gwen.png'
  },
  ahri: {
    name: 'Ahri', region: 'ionia', ability: 'full_row',
    abilityName: 'Orb of Deception',
    desc: 'Her spirit ball destroys one row horizontally.',
    weight: 1,
    art: 'assets/champions/ahri.png'
  },
  sivir: {
    name: 'Sivir', region: 'shurima', ability: 'region_nuke',
    abilityName: 'Boomerang Blade',
    desc: 'Kills every block of her own region on the board.',
    weight: 1,
    art: 'assets/champions/sivir.png'
  },
  twitch: {
    name: 'Twitch', region: 'zaun', ability: 'random_shots',
    abilityName: 'Spray and Pray',
    desc: 'Shoots 5 random blocks of any region.',
    weight: 1,
    art: 'assets/champions/twitch.png'
  },
  kaisa: {
    name: "Kai'Sa", region: 'void', ability: 'blast_3x3',
    abilityName: 'Icathian Rain',
    desc: 'Missiles the 3×3 area surrounding her.',
    weight: 1,
    art: 'assets/champions/kaisa.png'
  },
  sejuani: {
    name: 'Sejuani', region: 'freljord', ability: 'random_blast',
    abilityName: 'Glacial Prison',
    desc: 'Her bola shatters a random 3×3 area of the board.',
    weight: 1,
    art: 'assets/champions/sejuani.png'
  },
  pyke: {
    name: 'Pyke', region: 'bilgewater', ability: 'cross_x',
    abilityName: 'Death from Below',
    desc: 'Executes blocks in an X through both diagonals.',
    weight: 1,
    art: 'assets/champions/pyke.png'
  },
  teemo: {
    name: 'Teemo', region: 'bandleCity', ability: 'shrooms',
    abilityName: 'Noxious Trap',
    desc: 'Throws 3 shrooms that each blow up a 2×2.',
    weight: 1,
    art: 'assets/champions/teemo.png'
  },
  qiyana: {
    name: 'Qiyana', region: 'ixtal', ability: 'board_edge',
    abilityName: 'Supreme Display of Talent',
    desc: 'Destroys every block along the edge of the field.',
    weight: 1,
    art: 'assets/champions/qiyana.png'
  },
  aurelionSol: {
    name: 'Aurelion Sol', region: 'targon', ability: 'supernova',
    abilityName: 'Falling Star',
    desc: 'Destroys the whole board and pays a large bonus.',
    weight: 1,
    art: 'assets/champions/aurelionSol.png'
  },
  caitlyn: {
    name: 'Caitlyn', region: 'piltover', ability: 'detonate_champions',
    abilityName: 'Ace in the Hole',
    desc: 'Destroys every champion block and sets off their abilities.',
    weight: 1,
    art: 'assets/champions/caitlyn.png'
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

/* region key -> champion key, built once so the engine never scans. */
LOL.CHAMPION_BY_REGION = {};
LOL.CHAMPION_KEYS.forEach(function (k) {
  LOL.CHAMPION_BY_REGION[LOL.CHAMPIONS[k].region] = k;
});
