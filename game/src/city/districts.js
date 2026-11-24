// The eight districts of Marazul Bay: their names, the block styles each is built from, and
// which district any point of the map belongs to.
import { TILE } from '../core/config.js';

export const ROAD_COLUMNS = [14, 32, 50, 68, 86, 104, 122, 138];
export const ROAD_ROWS = [14, 30, 46, 62, 78, 94, 110, 126, 142];
export const ISLAND_COLUMNS = [180, 194];
export const ISLAND_ROWS = [62, 78, 94];
export const ISLAND_CENTRE = { tx: 187, ty: 78, rx: 17, ry: 26 };

export const DISTRICTS = {
  C: { name: 'Corona Heights', styles: ['villas', 'villas', 'villas', 'park'], palms: 0.3 },
  S: { name: 'Sawgrass Park', styles: ['park', 'villas', 'park', 'lowrise'], palms: 0.2 },
  B: { name: 'Barrio Coral', styles: ['lowrise', 'lowrise', 'shops', 'lowrise', 'midrise'], palms: 0.35 },
  V: { name: 'Vista Centro', styles: ['towers', 'towers', 'towers', 'plaza'], palms: 0.25 },
  P: { name: 'Palmetto Row', styles: ['shops', 'midrise', 'midrise', 'lowrise'], palms: 0.7 },
  D: { name: 'Playa Dorada', styles: ['hotels', 'hotels', 'midrise', 'shops'], palms: 1 },
  I: { name: 'Ironwharf', styles: ['warehouses', 'warehouses', 'yard'], palms: 0 },
  X: { name: 'Isla Perla', styles: ['mansions', 'resort'], palms: 1 },
};

// One letter per block: rows run north to south, columns west to east (the outer strips included).
const DISTRICT_ROWS = [
  'CCCCSSSDD',
  'CCCSSSPDD',
  'CCCSSPPDD',
  'BBBVVVPDD',
  'BBBVVVPDD',
  'BBBVVVPDD',
  'BBPPPPPDD',
  'IIIIIPPDD',
  'IIIIIIIDD',
  'IIIIIIIII',
];

function bandIndex(lines, tile) {
  let index = 0;
  while (index < lines.length && tile >= lines[index]) index += 1;
  return index;
}

/** The district key ('C', 'V', …) of the block in column `col`, row `row`. */
export function districtKeyForCell(col, row) {
  return DISTRICT_ROWS[row][col];
}

/** The district (name, styles) at a world position. */
export function districtAt(x, y) {
  const tx = x / TILE;
  if (tx > 160) return DISTRICTS.X;
  const col = bandIndex(ROAD_COLUMNS, tx);
  const row = bandIndex(ROAD_ROWS, y / TILE);
  return DISTRICTS[DISTRICT_ROWS[row][col]];
}
