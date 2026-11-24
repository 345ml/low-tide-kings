// Draws buildings in fake perspective: each roof is pushed away from the centre of the view in
// proportion to its height, the walls that then show are filled between ground and roof, with
// rows of windows that light up at night, and each kind of building gets its own roof.
import { LEAN } from '../core/config.js';
import { shadeColor } from '../core/mathUtil.js';
import { hash2 } from '../core/random.js';

const FACE_LIGHT = { north: 0.74, south: 1, west: 0.84, east: 0.92 };
const WINDOWED = { tower: 1, hotel: 1, deco: 1, flat: 1, shop: 1 };

function tint(hex, factor, sky) {
  return shadeColor(hex, factor * sky.light, sky.darkness * 0.35, sky.red, sky.green, sky.blue);
}

function wallQuad(ctx, camX, camY, ax, ay, bx, by, s0, s1) {
  ctx.beginPath();
  ctx.moveTo(camX + (ax - camX) * s0, camY + (ay - camY) * s0);
  ctx.lineTo(camX + (bx - camX) * s0, camY + (by - camY) * s0);
  ctx.lineTo(camX + (bx - camX) * s1, camY + (by - camY) * s1);
  ctx.lineTo(camX + (ax - camX) * s1, camY + (ay - camY) * s1);
  ctx.closePath();
}

function drawWall(ctx, building, camX, camY, sky, face, ax, ay, bx, by, faceIndex) {
  const top = 1 + building.height * LEAN;
  wallQuad(ctx, camX, camY, ax, ay, bx, by, 1, top);
  ctx.fillStyle = tint(building.wall, FACE_LIGHT[face], sky);
  ctx.fill();
  const length = Math.abs(bx - ax) + Math.abs(by - ay);
  if (WINDOWED[building.kind]) {
    const glassTower = building.kind === 'tower';
    const floors = Math.max(1, Math.round(building.height / (glassTower ? 26 : 22)));
    const night = sky.glow > 0.4;
    const dayGlass = tint(glassTower ? '#9fe0f0' : '#3d5a73', FACE_LIGHT[face], sky);
    for (let floor = 0; floor < floors; floor += 1) {
      const low = ((floor + (glassTower ? 0.14 : 0.28)) / floors) * building.height;
      const high = ((floor + (glassTower ? 0.9 : 0.74)) / floors) * building.height;
      wallQuad(ctx, camX, camY, ax, ay, bx, by, 1 + low * LEAN, 1 + high * LEAN);
      if (night) ctx.fillStyle = hash2(building.seed + floor * 7, faceIndex) < 0.52 ? (hash2(floor, building.seed) < 0.8 ? '#ffd98a' : '#9fe8ff') : '#161c2e';
      else ctx.fillStyle = building.kind === 'shop' && floor === 0 ? tint('#2a3b4d', 1, sky) : dayGlass;
      ctx.fill();
    }
    // Mullions split each band into windows.
    const count = Math.max(2, Math.round(length / (glassTower ? 26 : 20)));
    ctx.strokeStyle = tint(building.wall, FACE_LIGHT[face] * (glassTower ? 0.8 : 1), sky);
    ctx.lineWidth = glassTower ? 1.6 : 4;
    ctx.beginPath();
    for (let n = 1; n < count; n += 1) {
      const px = ax + ((bx - ax) * n) / count;
      const py = ay + ((by - ay) * n) / count;
      ctx.moveTo(px, py);
      ctx.lineTo(camX + (px - camX) * top, camY + (py - camY) * top);
    }
    ctx.stroke();
  } else if (building.kind === 'container' || building.kind === 'shed') {
    const count = Math.max(2, Math.round(length / 9));
    ctx.strokeStyle = tint(building.wall, FACE_LIGHT[face] * 0.78, sky);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let n = 1; n < count; n += 1) {
      const px = ax + ((bx - ax) * n) / count;
      const py = ay + ((by - ay) * n) / count;
      ctx.moveTo(px, py);
      ctx.lineTo(camX + (px - camX) * top, camY + (py - camY) * top);
    }
    ctx.stroke();
  } else if (building.kind === 'villa') {
    wallQuad(ctx, camX, camY, ax + (bx - ax) * 0.2, ay + (by - ay) * 0.2, ax + (bx - ax) * 0.8, ay + (by - ay) * 0.8, 1 + building.height * 0.3 * LEAN, 1 + building.height * 0.75 * LEAN);
    ctx.fillStyle = sky.glow > 0.4 ? '#ffd98a' : tint('#4d6b80', FACE_LIGHT[face], sky);
    ctx.fill();
  }
}

function boxes(ctx, building, sky, count) {
  for (let n = 0; n < count; n += 1) {
    const bx = 6 + hash2(building.seed, n) * Math.max(1, building.w - 26);
    const by = 6 + hash2(n, building.seed) * Math.max(1, building.h - 22);
    ctx.fillStyle = tint('#9aa3ad', 1, sky);
    ctx.fillRect(bx, by, 14, 10);
    ctx.fillStyle = tint('#6d7680', 1, sky);
    ctx.fillRect(bx + 2, by + 2, 10, 6);
  }
}

function drawRoof(ctx, building, sky) {
  const { w, h, kind } = building;
  const base = building.roof ?? building.wall;
  if (kind === 'villa') {
    // A hipped terracotta roof: four slopes meeting at a ridge.
    const ridge = Math.min(w, h) * 0.5;
    const slopes = [
      [[0, 0], [w, 0], [w - ridge, ridge], [ridge, ridge], 1.05],
      [[w, 0], [w, h], [w - ridge, h - ridge], [w - ridge, ridge], 0.9],
      [[0, h], [w, h], [w - ridge, h - ridge], [ridge, h - ridge], 0.8],
      [[0, 0], [0, h], [ridge, h - ridge], [ridge, ridge], 0.96],
    ];
    for (const [a, b, c, d, light] of slopes) {
      ctx.fillStyle = tint(base, light, sky);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.fill();
    }
    return;
  }
  const roofColor = kind === 'tower' ? '#c7ced6' : kind === 'container' ? base : kind === 'shed' ? (building.roof ?? '#aeb6bd') : shadeColor(base, 1.08);
  ctx.fillStyle = tint(roofColor.startsWith('#') ? roofColor : base, 1.06, sky);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = tint(base, 0.7, sky);
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  if (kind === 'container' || kind === 'shed') {
    ctx.strokeStyle = tint(base, 0.82, sky);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const along = w >= h;
    for (let p = 6; p < (along ? w : h); p += 7) {
      if (along) {
        ctx.moveTo(p, 3);
        ctx.lineTo(p, h - 3);
      } else {
        ctx.moveTo(3, p);
        ctx.lineTo(w - 3, p);
      }
    }
    ctx.stroke();
    if (kind === 'shed') {
      ctx.fillStyle = tint('#d9f1f7', 1, sky);
      for (let p = 18; p + 20 < w; p += 46) ctx.fillRect(p, h * 0.42, 20, h * 0.16);
    }
  } else if (kind === 'tower') {
    ctx.fillStyle = tint('#8f99a3', 1, sky);
    ctx.fillRect(w * 0.18, h * 0.18, w * 0.64, h * 0.64);
    if (building.seed % 4 === 0 && Math.min(w, h) > 90) {
      ctx.fillStyle = tint('#5c6570', 1, sky);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = tint('#ffd166', 1.1, sky);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 21, 0, Math.PI * 2);
      ctx.moveTo(w / 2 - 8, h / 2 - 10);
      ctx.lineTo(w / 2 - 8, h / 2 + 10);
      ctx.moveTo(w / 2 + 8, h / 2 - 10);
      ctx.lineTo(w / 2 + 8, h / 2 + 10);
      ctx.moveTo(w / 2 - 8, h / 2);
      ctx.lineTo(w / 2 + 8, h / 2);
      ctx.stroke();
    } else boxes(ctx, building, sky, 4);
  } else if (kind === 'hotel') {
    if (building.seed % 2 === 0 && Math.min(w, h) > 80) {
      ctx.fillStyle = tint('#f1e3c6', 1, sky);
      ctx.fillRect(w * 0.12, h * 0.16, w * 0.76, h * 0.68);
      ctx.fillStyle = tint('#36c5e0', 1.05, sky);
      ctx.beginPath();
      ctx.roundRect(w * 0.2, h * 0.28, w * 0.5, h * 0.42, 10);
      ctx.fill();
      ctx.fillStyle = tint('#ff6f91', 1, sky);
      for (let n = 0; n < 4; n += 1) ctx.fillRect(w * 0.76, h * (0.24 + n * 0.13), 9, 5);
    } else boxes(ctx, building, sky, 5);
  } else if (kind === 'deco') {
    ctx.fillStyle = tint(base, 1.16, sky);
    ctx.fillRect(w * 0.14, h * 0.14, w * 0.72, h * 0.72);
    ctx.fillStyle = tint('#ff7eb6', 1, sky);
    ctx.fillRect(w * 0.14, h * 0.14, w * 0.72, 4);
    ctx.fillStyle = tint('#27d3c3', 1, sky);
    ctx.fillRect(w * 0.14, h * 0.86 - 4, w * 0.72, 4);
    boxes(ctx, building, sky, 2);
  } else if (kind === 'kiosk') {
    for (let p = 0; p < w; p += 12) {
      ctx.fillStyle = tint(p % 24 === 0 ? '#ffffff' : base, 1, sky);
      ctx.fillRect(p, 0, 12, h);
    }
  } else {
    boxes(ctx, building, sky, 3);
    ctx.fillStyle = tint('#7f8c96', 1, sky);
    ctx.beginPath();
    ctx.arc(w - 14, 14, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw one building as seen from a camera whose view is centred on (camX, camY). */
export function drawBuilding(ctx, building, camX, camY, sky) {
  const { x, y, w, h } = building;
  if (camY < y) drawWall(ctx, building, camX, camY, sky, 'north', x, y, x + w, y, 0);
  if (camY > y + h) drawWall(ctx, building, camX, camY, sky, 'south', x, y + h, x + w, y + h, 1);
  if (camX < x) drawWall(ctx, building, camX, camY, sky, 'west', x, y, x, y + h, 2);
  if (camX > x + w) drawWall(ctx, building, camX, camY, sky, 'east', x + w, y, x + w, y + h, 3);
  const top = 1 + building.height * LEAN;
  ctx.save();
  ctx.translate(camX + (x - camX) * top, camY + (y - camY) * top);
  ctx.scale(top, top);
  drawRoof(ctx, building, sky);
  if (building.label) {
    ctx.font = '800 13px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(building.label).width + 14;
    ctx.fillStyle = 'rgba(16,19,28,0.86)';
    ctx.fillRect(w / 2 - width / 2, h / 2 - 11, width, 22);
    ctx.fillStyle = sky.glow > 0.4 ? '#ff8fd0' : '#ffe9b8';
    ctx.fillText(building.label, w / 2, h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

/** The building's shadow on the ground: its footprint swept along the sun's direction. */
export function drawBuildingShadow(ctx, building, sky) {
  const ox = sky.shadowX * building.height * 0.55;
  const oy = sky.shadowY * building.height * 0.55;
  const { x, y, w, h } = building;
  const left = ox < 0;
  ctx.beginPath();
  if (left) {
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + ox, y + oy);
    ctx.lineTo(x + ox, y + h + oy);
    ctx.lineTo(x + w + ox, y + h + oy);
    ctx.lineTo(x + w, y + h);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w + ox, y + oy);
    ctx.lineTo(x + w + ox, y + h + oy);
    ctx.lineTo(x + ox, y + h + oy);
    ctx.lineTo(x, y + h);
  }
  ctx.closePath();
  ctx.fill();
}
