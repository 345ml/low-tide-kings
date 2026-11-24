// How each kind of city block is laid out: towers, shops around a car park, villas with pools,
// parks, plazas, hotels, warehouses and the docks. Each filler receives a block's tile rectangle
// and a `site` (the tools to place buildings, props, floors and parking spots).
import { T, TILE } from '../core/config.js';

const PALETTES = {
  glass: ['#7fb7c9', '#5c8fb0', '#9ad0d6', '#6fa3a8', '#c9d8e0', '#4f7f9c', '#e8c9a8'],
  pastel: ['#f7b7a3', '#f9d7a0', '#a8e0d1', '#f4a6c0', '#bfe3f2', '#fff1d0', '#d7c4f0'],
  vivid: ['#ff8a5c', '#ffd166', '#4fd1c5', '#f06595', '#74c0fc', '#b197fc', '#ffa94d', '#8ce99a'],
  white: ['#fff6e6', '#ffe9d6', '#f2f7f5', '#ffe0ec', '#e3f6ff'],
  metal: ['#8c9aa5', '#a56a4c', '#5f7f95', '#b0a48a', '#6d7b6f', '#c2534a'],
  villa: ['#fff3e0', '#ffe0c2', '#f6efe4', '#ffd9d9', '#e8f4ea'],
  crate: ['#d9534f', '#3d8bbd', '#e0a030', '#4a9d6e', '#8a5fb5', '#e07a3f'],
};
const TERRACOTTA = ['#c96f4a', '#d9825b', '#b85c3e', '#e09a6a'];

function pickFrom(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function between(rng, low, high) {
  return low + rng() * (high - low);
}

/** Split a rectangle of tiles into lots at least minW by minH, leaving one-tile alleys between them. */
function subdivide(rng, x0, y0, x1, y1, minW, minH, lots) {
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const canX = w >= minW * 2 + 1;
  const canY = h >= minH * 2 + 1;
  if (!canX && !canY) {
    lots.push({ x0, y0, x1, y1 });
    return lots;
  }
  const alongX = canX && (!canY || w > h || (w === h && rng() < 0.5));
  if (alongX) {
    const cut = x0 + minW + Math.floor(rng() * (w - 2 * minW));
    subdivide(rng, x0, y0, cut - 1, y1, minW, minH, lots);
    subdivide(rng, cut + 1, y0, x1, y1, minW, minH, lots);
  } else {
    const cut = y0 + minH + Math.floor(rng() * (h - 2 * minH));
    subdivide(rng, x0, y0, x1, cut - 1, minW, minH, lots);
    subdivide(rng, x0, cut + 1, x1, y1, minW, minH, lots);
  }
  return lots;
}

function floorRect(site, rect, type) {
  for (let ty = rect.y0; ty <= rect.y1; ty += 1) for (let tx = rect.x0; tx <= rect.x1; tx += 1) site.setFloor(tx, ty, type);
}

function centreOf(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

function scatter(site, rect, type, count, extra) {
  for (let n = 0; n < count; n += 1) {
    const tx = rect.x0 + Math.floor(site.rng() * (rect.x1 - rect.x0 + 1));
    const ty = rect.y0 + Math.floor(site.rng() * (rect.y1 - rect.y0 + 1));
    if (!site.isOpen(tx, ty)) continue;
    site.addProp(type, (tx + 0.2 + site.rng() * 0.6) * TILE, (ty + 0.2 + site.rng() * 0.6) * TILE, extra);
  }
}

function lotBuildings(site, rect, options) {
  floorRect(site, rect, options.floor);
  const lots = subdivide(site.rng, rect.x0, rect.y0, rect.x1, rect.y1, options.minW, options.minH, []);
  for (const lot of lots) {
    let { x0, y0, x1, y1 } = lot;
    if (options.setback && x1 - x0 >= 4 && site.rng() < 0.5) {
      if (site.rng() < 0.5) x0 += 1;
      else x1 -= 1;
    }
    if (options.setback && y1 - y0 >= 4 && site.rng() < 0.5) {
      if (site.rng() < 0.5) y0 += 1;
      else y1 -= 1;
    }
    site.addBuilding(x0, y0, x1, y1, {
      kind: options.kind,
      wall: pickFrom(site.rng, PALETTES[options.palette]),
      roof: options.roofs ? pickFrom(site.rng, options.roofs) : null,
      height: Math.round(between(site.rng, options.height[0], options.height[1])),
    });
  }
  if (options.trees) scatter(site, rect, options.trees, options.treeCount ?? 6);
}

function fillTowers(site, rect) {
  lotBuildings(site, rect, { floor: T.PLAZA, minW: 5, minH: 4, kind: 'tower', palette: 'glass', height: [150, 400], setback: true, trees: 'planter', treeCount: 8 });
}

function fillMidrise(site, rect) {
  lotBuildings(site, rect, { floor: T.PLAZA, minW: 4, minH: 4, kind: 'deco', palette: 'pastel', height: [60, 140], setback: true, trees: 'palm', treeCount: 5 });
}

function fillLowrise(site, rect) {
  lotBuildings(site, rect, { floor: T.LOT, minW: 3, minH: 3, kind: 'flat', palette: 'vivid', height: [26, 62], setback: false, trees: 'palm', treeCount: 3 });
}

function fillHotels(site, rect) {
  lotBuildings(site, rect, { floor: T.PLAZA, minW: 5, minH: 4, kind: 'hotel', palette: 'white', height: [90, 240], setback: true, trees: 'palm', treeCount: 10 });
}

function fillWarehouses(site, rect) {
  lotBuildings(site, rect, { floor: T.LOT, minW: 5, minH: 4, kind: 'shed', palette: 'metal', height: [30, 54], setback: true });
  containerStacks(site, rect, 5);
}

function containerStacks(site, rect, count) {
  for (let n = 0; n < count; n += 1) {
    const horizontal = site.rng() < 0.5;
    const tx = rect.x0 + Math.floor(site.rng() * (rect.x1 - rect.x0));
    const ty = rect.y0 + Math.floor(site.rng() * (rect.y1 - rect.y0));
    const x1 = horizontal ? tx + 1 : tx;
    const y1 = horizontal ? ty : ty + 1;
    if (x1 > rect.x1 || y1 > rect.y1 || !site.canBuild(tx, ty, x1, y1)) continue;
    site.addBuilding(tx, ty, x1, y1, { kind: 'container', wall: pickFrom(site.rng, PALETTES.crate), roof: null, height: 14 + Math.floor(site.rng() * 3) * 12 });
  }
}

function parkingRow(site, x0, x1, ty, angle, fill) {
  for (let tx = x0; tx <= x1; tx += 1) {
    if (site.tileAt(tx, ty) !== T.LOT) continue;
    const spot = centreOf(tx, ty);
    site.parking.push({ x: spot.x, y: spot.y, angle, fill: site.rng() < fill });
  }
}

function fillShops(site, rect) {
  const height = rect.y1 - rect.y0 + 1;
  if (height < 9) {
    fillLowrise(site, rect);
    return;
  }
  const shop = { minW: 3, minH: 3, kind: 'shop', palette: 'pastel', height: [24, 40], floor: T.LOT, setback: false };
  lotBuildings(site, { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y0 + 2 }, shop);
  lotBuildings(site, { x0: rect.x0, y0: rect.y1 - 2, x1: rect.x1, y1: rect.y1 }, shop);
  const lot = { x0: rect.x0, y0: rect.y0 + 3, x1: rect.x1, y1: rect.y1 - 3 };
  floorRect(site, lot, T.LOT);
  parkingRow(site, lot.x0 + 1, lot.x1 - 1, lot.y0, -Math.PI / 2, 0.5);
  parkingRow(site, lot.x0 + 1, lot.x1 - 1, lot.y1, Math.PI / 2, 0.5);
}

function fillParking(site, rect) {
  floorRect(site, rect, T.LOT);
  for (let ty = rect.y0; ty + 3 <= rect.y1; ty += 4) {
    parkingRow(site, rect.x0 + 1, rect.x1 - 1, ty, -Math.PI / 2, 0.45);
    parkingRow(site, rect.x0 + 1, rect.x1 - 1, ty + 3, Math.PI / 2, 0.45);
  }
}

function fillVillas(site, rect, grand) {
  const lots = subdivide(site.rng, rect.x0, rect.y0, rect.x1, rect.y1, grand ? 6 : 5, grand ? 5 : 4, []);
  for (const lot of lots) {
    const w = lot.x1 - lot.x0 + 1;
    const h = lot.y1 - lot.y0 + 1;
    const hw = Math.min(grand ? 5 : 4, w - 2);
    const hh = Math.min(grand ? 4 : 3, h - 1);
    const left = site.rng() < 0.5;
    const hx = left ? lot.x0 : lot.x1 - hw + 1;
    site.addBuilding(hx, lot.y0, hx + hw - 1, lot.y0 + hh - 1, {
      kind: 'villa',
      wall: pickFrom(site.rng, PALETTES.villa),
      roof: pickFrom(site.rng, TERRACOTTA),
      height: grand ? 40 : 28,
    });
    const sideX = left ? hx + hw : lot.x0;
    const sideW = w - hw;
    if (sideW >= 2) {
      site.addProp('pool', (sideX + 0.3) * TILE, (lot.y0 + 0.4) * TILE, { w: (sideW - 0.6) * TILE, h: Math.min(2.2, hh - 0.6) * TILE });
    }
    if (h - hh >= 1) {
      const driveway = left ? hx : hx + hw - 1;
      site.setFloor(driveway, lot.y0 + hh, T.LOT);
      const spot = centreOf(driveway, lot.y0 + hh);
      site.parking.push({ x: spot.x, y: spot.y, angle: Math.PI / 2, fill: site.rng() < 0.6 });
    }
    scatter(site, lot, site.rng() < 0.6 ? 'palm' : 'tree', 3);
    scatter(site, lot, 'bush', 3);
  }
}

function fillPark(site, rect) {
  const midX = Math.floor((rect.x0 + rect.x1) / 2);
  const midY = Math.floor((rect.y0 + rect.y1) / 2);
  for (let tx = rect.x0; tx <= rect.x1; tx += 1) site.setFloor(tx, midY, T.PLAZA);
  for (let ty = rect.y0; ty <= rect.y1; ty += 1) site.setFloor(midX, ty, T.PLAZA);
  for (let ty = midY - 1; ty <= midY + 1; ty += 1) for (let tx = midX - 1; tx <= midX + 1; tx += 1) site.setFloor(tx, ty, T.PLAZA);
  site.addProp('fountain', (midX + 0.5) * TILE, (midY + 0.5) * TILE);
  for (let n = 0; n < 26; n += 1) {
    const tx = rect.x0 + Math.floor(site.rng() * (rect.x1 - rect.x0 + 1));
    const ty = rect.y0 + Math.floor(site.rng() * (rect.y1 - rect.y0 + 1));
    if (site.tileAt(tx, ty) !== T.GRASS) continue;
    site.addProp(site.rng() < 0.35 ? 'palm' : 'tree', (tx + site.rng()) * TILE, (ty + site.rng()) * TILE);
  }
  for (const dx of [-3, 3]) site.addProp('bench', (midX + dx + 0.5) * TILE, (midY + 0.5) * TILE);
  scatter(site, rect, 'bush', 10);
}

function fillPlaza(site, rect) {
  floorRect(site, rect, T.PLAZA);
  const midX = Math.floor((rect.x0 + rect.x1) / 2);
  const midY = Math.floor((rect.y0 + rect.y1) / 2);
  site.addProp('fountain', (midX + 0.5) * TILE, (midY + 0.5) * TILE);
  for (let tx = rect.x0 + 1; tx <= rect.x1 - 1; tx += 3) {
    site.addProp('planter', (tx + 0.5) * TILE, (rect.y0 + 1.5) * TILE);
    site.addProp('planter', (tx + 0.5) * TILE, (rect.y1 - 0.5) * TILE);
  }
  for (const [dx, dy] of [[-4, -3], [3, -3], [-4, 2], [3, 2]]) {
    const tx = midX + dx;
    const ty = midY + dy;
    if (site.canBuild(tx, ty, tx + 1, ty + 1)) {
      site.addBuilding(tx, ty, tx + 1, ty + 1, { kind: 'kiosk', wall: pickFrom(site.rng, PALETTES.vivid), roof: null, height: 16 });
    }
  }
  for (const dx of [-2, 2]) site.addProp('bench', (midX + dx + 0.5) * TILE, (midY + 0.5) * TILE);
}

function fillYard(site, rect) {
  floorRect(site, rect, T.LOT);
  containerStacks(site, rect, 22);
  parkingRow(site, rect.x0 + 1, rect.x1 - 1, rect.y1, Math.PI / 2, 0.3);
}

function fillDocks(site, rect) {
  containerStacks(site, rect, Math.floor(((rect.x1 - rect.x0) * (rect.y1 - rect.y0)) / 9));
  for (let tx = rect.x0 + 3; tx < rect.x1; tx += 11) site.addProp('crane', (tx + 0.5) * TILE, (rect.y1 - 0.5) * TILE);
}

function fillFringe(site, rect) {
  scatter(site, rect, 'palm', Math.floor(((rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1)) / 7));
  scatter(site, rect, 'bush', 6);
}

function fillResort(site, rect) {
  floorRect(site, rect, T.PLAZA);
  const split = Math.floor((rect.y0 + rect.y1) / 2);
  site.addBuilding(rect.x0, rect.y0, rect.x1, split - 1, { kind: 'hotel', wall: '#fff6e6', roof: null, height: 170 });
  site.addProp('pool', (rect.x0 + 1) * TILE, (split + 1.2) * TILE, { w: (rect.x1 - rect.x0 - 1) * TILE, h: (rect.y1 - split - 1.6) * TILE });
  scatter(site, { x0: rect.x0, y0: split, x1: rect.x1, y1: rect.y1 }, 'palm', 9);
  scatter(site, { x0: rect.x0, y0: split, x1: rect.x1, y1: rect.y1 }, 'umbrella', 8);
}

const FILLERS = {
  towers: fillTowers,
  midrise: fillMidrise,
  lowrise: fillLowrise,
  hotels: fillHotels,
  warehouses: fillWarehouses,
  shops: fillShops,
  parking: fillParking,
  villas: (site, rect) => fillVillas(site, rect, false),
  mansions: (site, rect) => fillVillas(site, rect, true),
  park: fillPark,
  plaza: fillPlaza,
  yard: fillYard,
  docks: fillDocks,
  fringe: fillFringe,
  resort: fillResort,
};

/** Lay out one block in the given style. `rect` is in tiles, both ends included. */
export function fillBlock(site, rect, style) {
  if (rect.x1 - rect.x0 < 1 || rect.y1 - rect.y0 < 1) return;
  (FILLERS[style] ?? fillFringe)(site, rect);
}
