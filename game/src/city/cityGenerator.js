// Builds Marazul Bay from a fixed seed: the coastline and island, the street grid and bridge,
// every block's buildings and props, parking spots, and the named places the story visits.
import { MAP_H, MAP_W, T, TILE } from '../core/config.js';
import { createRandom } from '../core/random.js';
import { fillBlock } from './blockStyles.js';
import { DISTRICTS, ISLAND_CENTRE, ISLAND_COLUMNS, ISLAND_ROWS, ROAD_COLUMNS, ROAD_ROWS, districtKeyForCell } from './districts.js';
import { buildRoadGraph } from './roadGraph.js';

const CITY_SEED = 20261124;
const BEACH_START = 143;
const DOCK_START = 145;
const SOUTH_EDGE = 152;
const PROP_CHUNK = 512;

/** Blocks whose style is fixed because a named place stands on them: "col,row" -> style. */
const FIXED_STYLES = {
  '2,4': 'lowrise',
  '1,5': 'lowrise',
  '4,6': 'shops',
  '5,7': 'shops',
  '4,2': 'midrise',
  '3,3': 'midrise',
  '5,4': 'towers',
  '4,5': 'towers',
  '4,4': 'plaza',
  '4,3': 'towers',
  '7,2': 'hotels',
  '7,5': 'hotels',
  '2,2': 'villas',
  '5,1': 'park',
  '3,8': 'warehouses',
  '2,8': 'yard',
};

function coastline(ty) {
  return 150 + Math.sin(ty * 0.09) * 3 + Math.sin(ty * 0.31) * 1.2;
}

function islandValue(tx, ty) {
  const dx = (tx - ISLAND_CENTRE.tx) / ISLAND_CENTRE.rx;
  const dy = (ty - ISLAND_CENTRE.ty) / ISLAND_CENTRE.ry;
  return dx * dx + dy * dy + Math.sin(tx * 0.9 + ty * 0.6) * 0.03;
}

function baseTile(tx, ty) {
  const island = islandValue(tx, ty);
  if (island < 1) return island > 0.84 ? T.SAND : T.GRASS;
  const west = 6 + Math.sin(ty * 0.21) * 1.3;
  const north = 6 + Math.sin(tx * 0.17) * 1.3;
  if (tx < west || ty < north || ty > SOUTH_EDGE || tx > coastline(ty)) return T.WATER;
  if (tx >= BEACH_START) return T.SAND;
  if (ty >= DOCK_START) return T.LOT;
  return T.GRASS;
}

/** The tile ranges of the blocks between a set of parallel streets, with an outer strip at each end. */
function blockBands(lines, firstStart, lastEnd) {
  const bands = [[firstStart, lines[0] - 4]];
  for (let i = 0; i + 1 < lines.length; i += 1) bands.push([lines[i] + 3, lines[i + 1] - 4]);
  bands.push([lines[lines.length - 1] + 3, lastEnd]);
  return bands;
}

export function generateCity() {
  const rng = createRandom(CITY_SEED);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const occupied = new Uint8Array(MAP_W * MAP_H);
  const buildings = [];
  const props = [];
  const parking = [];
  const graph = buildRoadGraph();

  for (let ty = 0; ty < MAP_H; ty += 1) for (let tx = 0; tx < MAP_W; tx += 1) tiles[ty * MAP_W + tx] = baseTile(tx, ty);

  const inMap = (tx, ty) => tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
  const tileAt = (tx, ty) => (inMap(tx, ty) ? tiles[ty * MAP_W + tx] : T.WATER);

  function paintStreet(edge, margin, type) {
    const a = graph.nodes[edge.a];
    const b = graph.nodes[edge.b];
    const x0 = (edge.horizontal ? a.tx : a.tx) - margin;
    const x1 = (edge.horizontal ? b.tx : a.tx) + margin - 1;
    const y0 = a.ty - margin;
    const y1 = (edge.horizontal ? a.ty : b.ty) + margin - 1;
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (!inMap(tx, ty)) continue;
        const index = ty * MAP_W + tx;
        if (tiles[index] === T.WATER || tiles[index] === T.BRIDGE) tiles[index] = T.BRIDGE;
        else if (tiles[index] !== T.ROAD) tiles[index] = type;
      }
    }
  }
  for (const edge of graph.edges) paintStreet(edge, 3, T.SIDEWALK);
  for (const edge of graph.edges) paintStreet(edge, 2, T.ROAD);

  // Two beach piers and the island marina.
  for (const [ty, x0, x1] of [[37, BEACH_START, 162], [117, BEACH_START, 160], [86, 201, 209]]) {
    for (let tx = x0; tx <= x1; tx += 1) for (let dy = 0; dy < 2; dy += 1) if (tileAt(tx, ty + dy) <= T.SAND) tiles[(ty + dy) * MAP_W + tx] = T.PIER;
    for (let tx = x1 - 3; tx <= x1; tx += 1) for (let dy = -1; dy < 3; dy += 1) tiles[(ty + dy) * MAP_W + tx] = T.PIER;
  }
  // The seafront promenade between the coast road and the sand.
  for (let ty = 0; ty < MAP_H; ty += 1) for (let tx = 141; tx <= 142; tx += 1) if (tileAt(tx, ty) === T.GRASS) tiles[ty * MAP_W + tx] = T.PLAZA;

  const site = {
    rng,
    parking,
    tileAt,
    setFloor(tx, ty, type) {
      if (!inMap(tx, ty) || occupied[ty * MAP_W + tx]) return;
      const current = tiles[ty * MAP_W + tx];
      if (current === T.GRASS || current === T.LOT || current === T.PLAZA) tiles[ty * MAP_W + tx] = type;
    },
    isOpen(tx, ty) {
      if (!inMap(tx, ty) || occupied[ty * MAP_W + tx]) return false;
      const current = tiles[ty * MAP_W + tx];
      return current === T.GRASS || current === T.LOT || current === T.PLAZA || current === T.SAND;
    },
    canBuild(x0, y0, x1, y1) {
      for (let ty = y0; ty <= y1; ty += 1) {
        for (let tx = x0; tx <= x1; tx += 1) {
          if (!inMap(tx, ty) || occupied[ty * MAP_W + tx]) return false;
          const current = tiles[ty * MAP_W + tx];
          if (current !== T.GRASS && current !== T.LOT && current !== T.PLAZA) return false;
        }
      }
      return true;
    },
    addBuilding(x0, y0, x1, y1, spec) {
      if (x1 < x0 || y1 < y0 || !site.canBuild(x0, y0, x1, y1)) return null;
      for (let ty = y0; ty <= y1; ty += 1) for (let tx = x0; tx <= x1; tx += 1) occupied[ty * MAP_W + tx] = 1;
      const building = {
        x: x0 * TILE,
        y: y0 * TILE,
        w: (x1 - x0 + 1) * TILE,
        h: (y1 - y0 + 1) * TILE,
        height: spec.height,
        kind: spec.kind,
        wall: spec.wall,
        roof: spec.roof,
        seed: Math.floor(rng() * 65536),
        label: null,
      };
      buildings.push(building);
      return building;
    },
    addProp(type, x, y, extra) {
      props.push({ type, x, y, seed: rng(), ...extra });
    },
  };

  // Mainland blocks.
  const columns = blockBands(ROAD_COLUMNS, 7, 140);
  const rows = blockBands(ROAD_ROWS, 7, SOUTH_EDGE - 1);
  const cellRect = (col, row) => ({ x0: columns[col][0], x1: columns[col][1], y0: rows[row][0], y1: rows[row][1] });
  for (let row = 0; row < rows.length; row += 1) {
    for (let col = 0; col < columns.length; col += 1) {
      const rect = cellRect(col, row);
      const outer = col === 0 || row === 0 || col === columns.length - 1;
      const district = DISTRICTS[districtKeyForCell(col, row)];
      let style = FIXED_STYLES[`${col},${row}`] ?? district.styles[Math.floor(rng() * district.styles.length)];
      if (row === rows.length - 1) style = 'docks';
      else if (outer) style = 'fringe';
      if (col === 3 && row === rows.length - 1) continue;
      fillBlock(site, rect, style);
    }
  }

  // Tavo's boatyard on the docks: a shed, boats on the hard and a slipway.
  const yard = cellRect(3, rows.length - 1);
  const yardX = Math.floor((yard.x0 + yard.x1) / 2);
  const shed = site.addBuilding(yardX - 5, yard.y0 + 3, yardX - 1, yard.y1, { kind: 'shed', wall: '#3fa7a0', roof: '#e9f3f1', height: 40 });
  if (shed) shed.label = "TAVO'S BOATYARD";
  for (let n = 0; n < 5; n += 1) props.push({ type: 'boat', x: (yardX + 1.5 + n * 1.6) * TILE, y: (yard.y1 - 1 - (n % 2) * 2.2) * TILE, seed: rng() });

  // Isla Perla.
  const islandColumns = blockBands(ISLAND_COLUMNS, 174, 200);
  const islandRows = blockBands(ISLAND_ROWS, 56, 100);
  for (let row = 0; row < islandRows.length; row += 1) {
    for (let col = 0; col < islandColumns.length; col += 1) {
      const rect = { x0: islandColumns[col][0], x1: islandColumns[col][1], y0: islandRows[row][0], y1: islandRows[row][1] };
      const inner = col === 1 && (row === 1 || row === 2);
      fillBlock(site, rect, inner ? (row === 1 ? 'resort' : 'mansions') : 'fringe');
      if (!inner) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const tx = rect.x0 + Math.floor(rng() * Math.max(1, rect.x1 - rect.x0 - 4));
          const ty = rect.y0 + Math.floor(rng() * Math.max(1, rect.y1 - rect.y0 - 3));
          site.addBuilding(tx, ty, tx + 3, ty + 2, { kind: 'villa', wall: '#fff3e0', roof: '#c96f4a', height: 36 });
        }
      }
    }
  }

  // Street furniture: lamps along every street, palms where the district calls for them.
  for (const edge of graph.edges) {
    const a = graph.nodes[edge.a];
    const b = graph.nodes[edge.b];
    const length = edge.horizontal ? b.tx - a.tx : b.ty - a.ty;
    for (let step = 4; step < length - 3; step += 1) {
      for (const side of [-1, 1]) {
        const offset = side * 2.5 * TILE;
        const x = edge.horizontal ? (a.tx + step) * TILE : a.x + offset;
        const y = edge.horizontal ? a.y + offset : (a.ty + step) * TILE;
        const tile = tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
        if (tile !== T.SIDEWALK && tile !== T.BRIDGE) continue;
        const key = a.tx > 160 ? 'X' : districtKeyForCell(Math.min(8, columnOf(x / TILE)), Math.min(9, rowOf(y / TILE)));
        if (step % 6 === (side > 0 ? 0 : 3)) props.push({ type: 'lamp', x, y, seed: rng() });
        else if (tile === T.SIDEWALK && step % 3 === 1 && rng() < DISTRICTS[key].palms * 0.8) props.push({ type: 'palm', x, y, seed: rng() });
        else if (tile === T.SIDEWALK && rng() < 0.03) props.push({ type: rng() < 0.5 ? 'hydrant' : 'bin', x, y, seed: rng() });
      }
    }
  }

  // Beach life, promenade palms and stray greenery.
  for (let ty = 8; ty < SOUTH_EDGE; ty += 1) {
    for (let tx = 8; tx < MAP_W - 2; tx += 1) {
      const tile = tiles[ty * MAP_W + tx];
      if (occupied[ty * MAP_W + tx]) continue;
      if (tile === T.SAND && rng() < 0.05) props.push({ type: rng() < 0.6 ? 'umbrella' : 'towel', x: (tx + rng()) * TILE, y: (ty + rng()) * TILE, seed: rng() });
      else if (tile === T.SAND && rng() < 0.012) props.push({ type: 'palm', x: (tx + rng()) * TILE, y: (ty + rng()) * TILE, seed: rng() });
      else if (tile === T.PLAZA && tx >= 141 && tx <= 142 && tx === 141 && ty % 4 === 0) props.push({ type: 'palm', x: (tx + 1) * TILE, y: (ty + 0.5) * TILE, seed: rng() });
      else if (tile === T.GRASS && rng() < 0.022) props.push({ type: rng() < 0.5 ? 'tree' : 'bush', x: (tx + rng()) * TILE, y: (ty + rng()) * TILE, seed: rng() });
    }
  }

  // Collision: 1 is a building, 2 is open water.
  const solid = new Uint8Array(MAP_W * MAP_H);
  for (let index = 0; index < solid.length; index += 1) solid[index] = occupied[index] ? 1 : tiles[index] === T.WATER ? 2 : 0;

  // Props bucketed by chunk so the renderer only walks the ones in view.
  const chunkColumns = Math.ceil((MAP_W * TILE) / PROP_CHUNK);
  const chunkRows = Math.ceil((MAP_H * TILE) / PROP_CHUNK);
  const propChunks = Array.from({ length: chunkColumns * chunkRows }, () => []);
  for (const prop of props) {
    const cx = Math.min(chunkColumns - 1, Math.max(0, Math.floor(prop.x / PROP_CHUNK)));
    const cy = Math.min(chunkRows - 1, Math.max(0, Math.floor(prop.y / PROP_CHUNK)));
    propChunks[cy * chunkColumns + cx].push(prop);
  }

  /** A spot on the pavement beside a block: its south side unless `side` is 'n'. */
  function frontage(col, row, side = 's', shift = 0) {
    const rect = cellRect(col, row);
    const tx = (rect.x0 + rect.x1 + 1) / 2 + shift;
    const ty = side === 'n' ? rect.y0 - 0.5 : rect.y1 + 1.5;
    return { x: tx * TILE, y: ty * TILE };
  }

  const places = {
    arrival: frontage(7, 2, 's'),
    safehouse: frontage(2, 4, 's'),
    boatyard: { x: (yardX + 1.5) * TILE, y: (yard.y0 + 1.5) * TILE },
    gunShop: frontage(4, 6, 's'),
    paintShop: frontage(5, 7, 'n'),
    hospital: frontage(4, 2, 's'),
    policeStation: frontage(3, 3, 's'),
    showroom: frontage(5, 4, 's'),
    newsroom: frontage(4, 5, 'n'),
    laundromat: frontage(1, 5, 's'),
    marrowTower: frontage(4, 3, 's'),
    plaza: frontage(4, 4, 's'),
    marina: { x: 203.5 * TILE, y: 87 * TILE },
    islandGate: { x: 186.5 * TILE, y: 79.5 * TILE },
    pierNorth: { x: 158 * TILE, y: 38 * TILE },
    pierSouth: { x: 156 * TILE, y: 118 * TILE },
    barrioA: frontage(0, 3, 's', 12),
    barrioB: frontage(1, 4, 'n'),
    barrioC: frontage(2, 5, 's'),
    barrioD: frontage(1, 6, 'n'),
    wharfGate: frontage(3, 8, 's'),
    wharfYard: frontage(2, 8, 's'),
    beachNorth: frontage(7, 1, 's'),
    beachSouth: frontage(7, 6, 's'),
    heights: frontage(1, 1, 's'),
  };

  // Name plates on the buildings that front the service places.
  const signs = [['safehouse', 'CASA CORAL APTS'], ['gunShop', 'BRINE & BARREL'], ['paintShop', 'FRESHCOAT AUTO'], ['hospital', 'ST. BRISA MEDICAL'], ['policeStation', 'MBPD'], ['showroom', 'MARROW MOTORS'], ['newsroom', 'THE BAY LEDGER'], ['laundromat', 'SUDS CORAL'], ['marrowTower', 'MARROW TOWER']];
  for (const [key, label] of signs) {
    const spot = places[key];
    let best = null;
    let bestDistance = Infinity;
    for (const building of buildings) {
      const dx = Math.max(building.x - spot.x, 0, spot.x - building.x - building.w);
      const dy = Math.max(building.y - spot.y, 0, spot.y - building.y - building.h);
      if (dx * dx + dy * dy < bestDistance && !building.label) {
        bestDistance = dx * dx + dy * dy;
        best = building;
      }
    }
    if (best) best.label = label;
  }

  return { tiles, solid, buildings, props, propChunks, chunkColumns, chunkRows, propChunkSize: PROP_CHUNK, parking, graph, places, seedRandom: rng };
}

function columnOf(tx) {
  let index = 0;
  while (index < ROAD_COLUMNS.length && tx >= ROAD_COLUMNS[index]) index += 1;
  return index;
}

function rowOf(ty) {
  let index = 0;
  while (index < ROAD_ROWS.length && ty >= ROAD_ROWS[index]) index += 1;
  return index;
}
