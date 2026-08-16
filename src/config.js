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

  /* ---------- match rules ---------- */
  MATCH_MIN: 3,           // how many same-region cells in a line destroys them
  MATCH_HORIZONTAL: true,
  MATCH_VERTICAL: true,
  FULL_ROW_CLEARS: true,  // a completely filled row always clears (safety valve)
  CHAMPS_CLEARED_BY_MATCH: true, // champions are consumed by region matches too

  /* ---------- piece generation ---------- */
  PRIMARY_REGION_BIAS: 0.62, // chance a cell takes its piece's primary region
  CHAMPION_CHANCE: 0.14,     // chance the next piece is a 1x1 champion instead

  /* ---------- timing (ms) ---------- */
  DROP_BASE: 800,         // fall interval at level 1
  DROP_MIN: 90,           // fastest it ever gets
  LOCK_DELAY: 380,        // grace period once a piece touches down
  FLASH_MS: 130,          // how long matched blocks glow before vanishing

  /* ---------- progression ---------- */
  CELLS_PER_LEVEL: 40,    // cells cleared needed to gain a level
  SCORE_PER_CELL: 10,
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
 * `art` is optional. If the file is absent the renderer falls back to a clean
 * flat tile in `color` with the `short` label — the game is fully playable
 * with zero art.
 */
LOL.REGIONS = {
  demacia:    { name: 'Demacia',    short: 'DE', color: '#d8b45a', art: 'assets/regions/demacia.svg' },
  noxus:      { name: 'Noxus',      short: 'NO', color: '#bf3b34', art: 'assets/regions/noxus.svg' },
  ionia:      { name: 'Ionia',      short: 'IO', color: '#d97ab8', art: 'assets/regions/ionia.svg' },
  freljord:   { name: 'Freljord',   short: 'FR', color: '#5fb6dd', art: 'assets/regions/freljord.svg' },
  zaun:       { name: 'Zaun',       short: 'ZA', color: '#6cc24a', art: 'assets/regions/zaun.svg' },
  bilgewater: { name: 'Bilgewater', short: 'BI', color: '#d4772c', art: 'assets/regions/bilgewater.svg' }
};

/*
 * CHAMPIONS
 * Every champion belongs to a region (so it also counts as that region for
 * matching) and names one ability from src/abilities.js.
 */
LOL.CHAMPIONS = {
  darius: {
    name: 'Darius', region: 'noxus', ability: 'column_below',
    abilityName: 'Noxian Guillotine',
    desc: 'Destroys every block in the column directly below him.',
    art: 'assets/champions/darius.svg'
  },
  lux: {
    name: 'Lux', region: 'demacia', ability: 'full_row',
    abilityName: 'Final Spark',
    desc: 'Destroys every block in her row.',
    art: 'assets/champions/lux.svg'
  },
  ziggs: {
    name: 'Ziggs', region: 'zaun', ability: 'blast_3x3',
    abilityName: 'Mega Inferno Bomb',
    desc: 'Destroys everything in a 3×3 area around him.',
    art: 'assets/champions/ziggs.svg'
  },
  ashe: {
    name: 'Ashe', region: 'freljord', ability: 'convert_neighbours',
    abilityName: 'Frost Shot',
    desc: 'Converts all 8 neighbouring blocks to Freljord.',
    art: 'assets/champions/ashe.svg'
  },
  yasuo: {
    name: 'Yasuo', region: 'ionia', ability: 'side_columns',
    abilityName: 'Steel Tempest',
    desc: 'Destroys the columns to his left and right, below him.',
    art: 'assets/champions/yasuo.svg'
  },
  missFortune: {
    name: 'Miss Fortune', region: 'bilgewater', ability: 'region_nuke',
    abilityName: 'Double Up',
    desc: 'Destroys every block on the board sharing the region beneath her.',
    art: 'assets/champions/miss-fortune.svg'
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
