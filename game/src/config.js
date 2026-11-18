// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends on
// the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The shadow road: enemies walk it from off-screen left to the lighthouse door. */
export const PATH = [
  [-40, 110],
  [880, 110],
  [880, 300],
  [280, 300],
  [280, 500],
  [880, 500],
  [880, 380],
  [1120, 380],
];

export const LIGHTHOUSE = { x: 1160, y: 380, radius: 42 };

/** Build plots are generated on a grid and kept only when clear of the path. */
export const PLOT = { spacing: 92, size: 56, pathClearance: 48, keepClearance: 100 };

export const START = { gold: 160, lives: 20, wave: 0, maxWave: 12 };

/** Tower types, in the order their cards show in the build bar. */
export const TOWERS = {
  ember: {
    key: 'ember',
    name: 'Ember Turret',
    cost: 50,
    range: 115,
    damage: 14,
    rate: 2.0,
    projectileSpeed: 520,
    splash: 0,
    slow: 0,
    chain: 0,
    color: '#ff9f43',
    blurb: 'Fast shots, cheap.',
  },
  frost: {
    key: 'frost',
    name: 'Frost Lantern',
    cost: 60,
    range: 105,
    damage: 5,
    rate: 1.0,
    projectileSpeed: 460,
    splash: 0,
    slow: 0.45,
    slowDuration: 1.6,
    chain: 0,
    color: '#7dd3fc',
    blurb: 'Chills to 45% speed.',
  },
  cannon: {
    key: 'cannon',
    name: 'Cannon',
    cost: 110,
    range: 135,
    damage: 38,
    rate: 0.55,
    projectileSpeed: 380,
    splash: 62,
    slow: 0,
    chain: 0,
    color: '#f472b6',
    blurb: 'Big splash damage.',
  },
  arc: {
    key: 'arc',
    name: 'Arc Coil',
    cost: 130,
    range: 125,
    damage: 11,
    rate: 1.1,
    projectileSpeed: 0,
    splash: 0,
    slow: 0,
    chain: 3,
    color: '#c084fc',
    blurb: 'Jumps to 3 foes.',
  },
};

/** Upgrade cost per level, as a share of the tower's base cost; each level is +60% damage, +12 range. */
export const UPGRADE = { levelCost: [0, 0.8, 1.2], damageGrowth: 1.6, rangeGrowth: 12, maxLevel: 3 };

/** Selling a tower refunds this share of everything spent on it. */
export const SELL_REFUND = 0.7;

/** Enemy types. `damage` is the lighthouse lives lost when one gets through. */
export const ENEMIES = {
  wisp: { key: 'wisp', name: 'Wisp', hp: 26, speed: 78, bounty: 6, damage: 1, radius: 11, color: '#a78bfa' },
  crawler: { key: 'crawler', name: 'Crawler', hp: 130, speed: 38, bounty: 10, damage: 2, radius: 16, color: '#f87171' },
  bat: { key: 'bat', name: 'Dusk Bat', hp: 34, speed: 105, bounty: 8, damage: 1, radius: 10, color: '#fbbf24' },
  brute: { key: 'brute', name: 'Brute', hp: 330, speed: 30, bounty: 18, damage: 3, radius: 20, color: '#ef4444' },
  boss: { key: 'boss', name: 'Gloomlord', hp: 1800, speed: 26, bounty: 200, damage: 10, radius: 30, color: '#e879f9' },
};

/** Wave rules: composition and scaling by wave number (1-based). */
export const WAVE = {
  hpGrowth: 0.22,
  speedGrowth: 0.02,
  spawnInterval: 0.9,
  spawnIntervalMin: 0.45,
  clearBonus: (n) => 20 + 5 * n,
};

export const PALETTE = {
  skyTop: '#0b1026',
  skyBottom: '#1b2a4a',
  ground: '#16213a',
  path: '#3a3f5c',
  pathEdge: '#4d5478',
  plot: '#22304f',
  plotHot: '#2e4066',
  panel: '#101827',
  panelEdge: '#2c3a55',
  text: '#eef1f5',
  muted: '#93a0b8',
  gold: '#f2c94c',
  heart: '#f87171',
  towerRing: 'rgba(255, 255, 255, 0.35)',
  beam: 'rgba(255, 220, 130, 0.10)',
  lamp: '#ffe9a8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-keep.best';
