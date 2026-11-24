// Shared constants for Low Tide Kings: map size, tile kinds, timing and tuning values.

export const TILE = 32;
export const MAP_W = 212;
export const MAP_H = 160;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

/** Fixed simulation step, in seconds. */
export const STEP = 1 / 60;

/** Ground tile kinds. */
export const T = {
  WATER: 0,
  SAND: 1,
  GRASS: 2,
  ROAD: 3,
  SIDEWALK: 4,
  PLAZA: 5,
  PIER: 6,
  LOT: 7,
  BRIDGE: 8,
};

/** Road geometry, in world units. */
export const ROAD_HALF = 2 * TILE;
export const LANE_OFFSET = TILE;
export const STOP_BACK = ROAD_HALF + 22;

/** One in-game day lasts this many real seconds. */
export const DAY_SECONDS = 720;

export const SAVE_KEY = 'low-tide-kings.save.v1';

/** How strongly tall things lean away from the screen centre (fake perspective). */
export const LEAN = 1 / 760;

export const POPULATION = {
  traffic: 24,
  pedestrians: 46,
  spawnMin: 620,
  spawnMax: 1050,
  despawn: 1350,
};

export const PLAYER_TUNING = {
  walk: 105,
  sprint: 190,
  radius: 8,
  maxHealth: 100,
  maxArmor: 100,
  enterRange: 62,
};

export const WANTED_TUNING = {
  thresholds: [0, 18, 70, 160, 300, 480],
  witnessRange: 430,
  sightRange: 540,
  searchBase: 7,
  searchPerStar: 3.5,
};

export const COLORS = {
  ui: '#fff4d6',
  accent: '#ff5fa2',
  teal: '#27d3c3',
  gold: '#ffc94a',
  danger: '#ff4d4d',
  ink: '#10131c',
};
