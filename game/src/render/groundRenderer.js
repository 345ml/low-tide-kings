// Paints the ground: sand, grass, streets with their markings and crossings, pavements, plazas,
// piers, car parks and the bridge deck. The map is drawn once into cached chunk images; the sea
// shows through underneath and is animated every frame.
import { MAP_H, MAP_W, ROAD_HALF, T, TILE } from '../core/config.js';
import { hash2 } from '../core/random.js';

const CHUNK_TILES = 16;
const CHUNK_SIZE = CHUNK_TILES * TILE;
const MAX_CACHED = 70;

const SAND = ['#f3e0ae', '#f0dba6', '#f6e4b6'];
const GRASS = ['#74c276', '#6dbb70', '#7bc87c', '#68b46c'];

export function createGroundRenderer(city) {
  const cache = new Map();
  const tiles = city.tiles;
  const tile = (tx, ty) => (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H ? T.WATER : tiles[ty * MAP_W + tx]);
  const isLand = (type) => type !== T.WATER && type !== T.BRIDGE && type !== T.PIER;

  function paintTile(ctx, tx, ty) {
    const type = tile(tx, ty);
    const x = tx * TILE;
    const y = ty * TILE;
    const noise = hash2(tx, ty);
    const north = tile(tx, ty - 1);
    const south = tile(tx, ty + 1);
    const west = tile(tx - 1, ty);
    const east = tile(tx + 1, ty);
    const sides = [[north, x, y, TILE, 0], [south, x, y + TILE, TILE, 0], [west, x, y, 0, TILE], [east, x + TILE, y, 0, TILE]];
    if (type === T.WATER) {
      // Turquoise shallows beside the shore.
      let near = 3;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (isLand(tile(tx + dx, ty + dy))) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
      if (near < 3) {
        ctx.fillStyle = near === 1 ? 'rgba(150,240,225,0.55)' : 'rgba(120,228,218,0.3)';
        ctx.fillRect(x, y, TILE, TILE);
      }
      return;
    }
    if (type === T.SAND) {
      ctx.fillStyle = SAND[Math.floor(noise * SAND.length)];
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(190,160,100,0.35)';
      for (let n = 0; n < 3; n += 1) ctx.fillRect(x + hash2(tx * 7 + n, ty) * 30, y + hash2(tx, ty * 5 + n) * 30, 2, 2);
      for (const [other, sx, sy, w, h] of sides) {
        if (other !== T.WATER) continue;
        ctx.fillStyle = 'rgba(205,180,125,0.9)';
        ctx.fillRect(w ? sx : sx - (sx > x ? 9 : 0), h ? sy : sy - (sy > y ? 9 : 0), w || 9, h || 9);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(w ? sx : sx - (sx > x ? 3 : 0), h ? sy : sy - (sy > y ? 3 : 0), w || 3, h || 3);
      }
    } else if (type === T.GRASS) {
      ctx.fillStyle = GRASS[Math.floor(noise * GRASS.length)];
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(40,110,60,0.25)';
      for (let n = 0; n < 4; n += 1) ctx.fillRect(x + hash2(tx * 3 + n, ty * 11) * 29, y + hash2(tx * 13, ty + n * 5) * 29, 3, 2);
      for (const [other, sx, sy, w, h] of sides) {
        if (other !== T.WATER) continue;
        ctx.fillStyle = '#8a7a55';
        ctx.fillRect(w ? sx : sx - (sx > x ? 4 : 0), h ? sy : sy - (sy > y ? 4 : 0), w || 4, h || 4);
      }
    } else if (type === T.ROAD || type === T.BRIDGE) {
      ctx.fillStyle = type === T.ROAD ? (noise < 0.5 ? '#3b404c' : '#3e4350') : '#4a505c';
      ctx.fillRect(x, y, TILE, TILE);
      if (noise > 0.9) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + noise * 20, y + 6, 9, 3);
      }
      if (type === T.BRIDGE) {
        for (const [other, sx, sy, w, h] of sides) {
          if (other !== T.WATER) continue;
          ctx.fillStyle = '#d8dde3';
          ctx.fillRect(w ? sx : sx - (sx > x ? 5 : 0), h ? sy : sy - (sy > y ? 5 : 0), w || 5, h || 5);
          ctx.fillStyle = '#8f98a3';
          ctx.fillRect(w ? sx : sx - (sx > x ? 8 : -5), h ? sy : sy - (sy > y ? 8 : -5), w || 3, h || 3);
        }
      }
    } else if (type === T.SIDEWALK) {
      ctx.fillStyle = noise < 0.5 ? '#d6cfc0' : '#d1cabb';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(120,110,95,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE / 2, TILE / 2);
      ctx.strokeRect(x + TILE / 2 + 0.5, y + TILE / 2 + 0.5, TILE / 2, TILE / 2);
      for (const [other, sx, sy, w, h] of sides) {
        if (other !== T.ROAD && other !== T.BRIDGE) continue;
        ctx.fillStyle = '#9d968a';
        ctx.fillRect(w ? sx : sx - (sx > x ? 4 : 0), h ? sy : sy - (sy > y ? 4 : 0), w || 4, h || 4);
      }
    } else if (type === T.PLAZA) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? '#ead9c2' : '#e2cfb5';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(214,120,96,0.28)';
      ctx.fillRect(x + 13, y + 13, 6, 6);
    } else if (type === T.PIER) {
      ctx.fillStyle = noise < 0.5 ? '#b98d5e' : '#b08455';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(70,45,20,0.35)';
      for (let n = 0; n < 4; n += 1) ctx.fillRect(x + n * 8, y, 1.5, TILE);
      for (const [other, sx, sy, w, h] of sides) {
        if (other !== T.WATER) continue;
        ctx.fillStyle = '#7a5632';
        ctx.fillRect(w ? sx : sx - (sx > x ? 4 : 0), h ? sy : sy - (sy > y ? 4 : 0), w || 4, h || 4);
      }
    } else {
      ctx.fillStyle = noise < 0.5 ? '#5a606b' : '#5e646f';
      ctx.fillRect(x, y, TILE, TILE);
      if (noise > 0.86) {
        ctx.fillStyle = 'rgba(20,20,25,0.25)';
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 16, 7, 4, noise * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const [other, sx, sy, w, h] of sides) {
        if (other !== T.WATER) continue;
        ctx.fillStyle = '#c9ced6';
        ctx.fillRect(w ? sx : sx - (sx > x ? 5 : 0), h ? sy : sy - (sy > y ? 5 : 0), w || 5, h || 5);
      }
    }
  }

  function paintStreetMarkings(ctx, x0, y0) {
    const x1 = x0 + CHUNK_SIZE;
    const y1 = y0 + CHUNK_SIZE;
    const { nodes, edges } = city.graph;
    for (const edge of edges) {
      const a = nodes[edge.a];
      const b = nodes[edge.b];
      if (Math.max(a.x, b.x) < x0 - 80 || Math.min(a.x, b.x) > x1 + 80 || Math.max(a.y, b.y) < y0 - 80 || Math.min(a.y, b.y) > y1 + 80) continue;
      const inset = ROAD_HALF + 26;
      // Double yellow centre line.
      ctx.strokeStyle = '#f2c14e';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      for (const shift of [-2.5, 2.5]) {
        ctx.beginPath();
        if (edge.horizontal) {
          ctx.moveTo(a.x + inset, a.y + shift);
          ctx.lineTo(b.x - inset, b.y + shift);
        } else {
          ctx.moveTo(a.x + shift, a.y + inset);
          ctx.lineTo(b.x + shift, b.y - inset);
        }
        ctx.stroke();
      }
      // White edge lines.
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      for (const shift of [-ROAD_HALF + 6, ROAD_HALF - 6]) {
        ctx.beginPath();
        if (edge.horizontal) {
          ctx.moveTo(a.x + inset, a.y + shift);
          ctx.lineTo(b.x - inset, b.y + shift);
        } else {
          ctx.moveTo(a.x + shift, a.y + inset);
          ctx.lineTo(b.x + shift, b.y - inset);
        }
        ctx.stroke();
      }
      // Zebra crossings and stop lines at both ends.
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      for (const [node, direction] of [[a, 1], [b, -1]]) {
        const start = ROAD_HALF + 5;
        for (let stripe = -ROAD_HALF + 6; stripe < ROAD_HALF - 6; stripe += 13) {
          if (edge.horizontal) ctx.fillRect(node.x + direction * start - (direction < 0 ? 14 : 0), node.y + stripe, 14, 7);
          else ctx.fillRect(node.x + stripe, node.y + direction * start - (direction < 0 ? 14 : 0), 7, 14);
        }
      }
    }
    // Parking bay lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    for (const spot of city.parking) {
      if (spot.x < x0 - 40 || spot.x > x1 + 40 || spot.y < y0 - 40 || spot.y > y1 + 40) continue;
      ctx.beginPath();
      ctx.moveTo(spot.x - 16, spot.y - 22);
      ctx.lineTo(spot.x - 16, spot.y + 22);
      ctx.moveTo(spot.x + 16, spot.y - 22);
      ctx.lineTo(spot.x + 16, spot.y + 22);
      ctx.stroke();
    }
  }

  function buildChunk(cx, cy) {
    const canvas = document.createElement('canvas');
    canvas.width = CHUNK_SIZE;
    canvas.height = CHUNK_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.translate(-cx * CHUNK_SIZE, -cy * CHUNK_SIZE);
    for (let ty = cy * CHUNK_TILES; ty < (cy + 1) * CHUNK_TILES; ty += 1) {
      for (let tx = cx * CHUNK_TILES; tx < (cx + 1) * CHUNK_TILES; tx += 1) paintTile(ctx, tx, ty);
    }
    paintStreetMarkings(ctx, cx * CHUNK_SIZE, cy * CHUNK_SIZE);
    return canvas;
  }

  return {
    /** The open sea: a flat colour for the hour of day with drifting wave glints. */
    drawSea(ctx, bounds, clock, sky) {
      const dim = 1 - sky.darkness * 0.5;
      ctx.fillStyle = `rgb(${Math.round(28 * dim)},${Math.round(168 * dim)},${Math.round(190 * dim)})`;
      ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const cell = 110;
      ctx.beginPath();
      for (let gy = Math.floor(bounds.y0 / cell); gy <= Math.floor(bounds.y1 / cell); gy += 1) {
        for (let gx = Math.floor(bounds.x0 / cell); gx <= Math.floor(bounds.x1 / cell); gx += 1) {
          const seed = hash2(gx, gy);
          const x = gx * cell + seed * cell + Math.sin(clock * 0.6 + seed * 9) * 14;
          const y = gy * cell + hash2(gy, gx) * cell + Math.cos(clock * 0.45 + seed * 7) * 8;
          const length = 10 + seed * 22;
          ctx.moveTo(x - length, y);
          ctx.quadraticCurveTo(x, y - 5, x + length, y);
        }
      }
      ctx.stroke();
    },
    drawGround(ctx, bounds) {
      const cx0 = Math.max(0, Math.floor(bounds.x0 / CHUNK_SIZE));
      const cy0 = Math.max(0, Math.floor(bounds.y0 / CHUNK_SIZE));
      const cx1 = Math.min(Math.ceil(MAP_W / CHUNK_TILES) - 1, Math.floor(bounds.x1 / CHUNK_SIZE));
      const cy1 = Math.min(Math.ceil(MAP_H / CHUNK_TILES) - 1, Math.floor(bounds.y1 / CHUNK_SIZE));
      for (let cy = cy0; cy <= cy1; cy += 1) {
        for (let cx = cx0; cx <= cx1; cx += 1) {
          const key = cy * 1000 + cx;
          let chunk = cache.get(key);
          if (!chunk) {
            if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value);
            chunk = buildChunk(cx, cy);
            cache.set(key, chunk);
          }
          ctx.drawImage(chunk, cx * CHUNK_SIZE, cy * CHUNK_SIZE, CHUNK_SIZE + 0.5, CHUNK_SIZE + 0.5);
        }
      }
    },
  };
}
