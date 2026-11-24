// The minimap and the full city map: the whole of Marazul Bay painted once into a small image,
// then shown around the player in a round radar with blips for goals, shops, police and enemies.
import { MAP_H, MAP_W, T, TILE } from '../core/config.js';

const PIXELS_PER_TILE = 4;
const TILE_COLORS = ['#1b8fa6', '#ecd9a4', '#5fae69', '#474c58', '#bdb6a8', '#d9c9b0', '#a57c50', '#666c77', '#5a606c'];

export function createCityMap(city) {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_W * PIXELS_PER_TILE;
  canvas.height = MAP_H * PIXELS_PER_TILE;
  const ctx = canvas.getContext('2d');
  for (let ty = 0; ty < MAP_H; ty += 1) {
    for (let tx = 0; tx < MAP_W; tx += 1) {
      ctx.fillStyle = TILE_COLORS[city.tiles[ty * MAP_W + tx]];
      ctx.fillRect(tx * PIXELS_PER_TILE, ty * PIXELS_PER_TILE, PIXELS_PER_TILE, PIXELS_PER_TILE);
    }
  }
  const scale = PIXELS_PER_TILE / TILE;
  for (const building of city.buildings) {
    ctx.fillStyle = building.kind === 'tower' ? '#8fa3b5' : building.kind === 'villa' ? '#c98562' : '#d8b8a0';
    ctx.fillRect(building.x * scale, building.y * scale, building.w * scale, building.h * scale);
    ctx.strokeStyle = 'rgba(40,40,60,0.5)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(building.x * scale, building.y * scale, building.w * scale, building.h * scale);
  }
  return { canvas, scale };
}

function blipColor(marker) {
  return marker.color ?? '#ffffff';
}

function drawBlip(ctx, x, y, marker, size) {
  ctx.fillStyle = '#10131c';
  ctx.beginPath();
  ctx.arc(x, y, size + 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = blipColor(marker);
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  if (marker.label) {
    ctx.fillStyle = '#10131c';
    ctx.font = `800 ${Math.round(size * 1.5)}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(marker.label, x, y + 0.5);
    ctx.textBaseline = 'alphabetic';
  }
}

/** The round radar: centred on the player, north up, with far-off goals pinned to its rim. */
export function drawMinimap(ctx, cityMap, world, cx, cy, radius) {
  const zoom = radius / 620;
  const focus = world.focus;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#1b8fa6';
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  const k = zoom / cityMap.scale;
  ctx.drawImage(cityMap.canvas, cx - focus.x * zoom, cy - focus.y * zoom, cityMap.canvas.width * k, cityMap.canvas.height * k);
  const place = (x, y) => ({ x: cx + (x - focus.x) * zoom, y: cy + (y - focus.y) * zoom });
  const flash = Math.floor(world.clock * 6) % 2 === 0;
  for (const vehicle of world.vehicles) {
    if (!vehicle.police || vehicle.wrecked || !vehicle.ai || vehicle.ai.type !== 'pursuit') continue;
    const p = place(vehicle.x, vehicle.y);
    ctx.fillStyle = flash ? '#ff4d4d' : '#4d8dff';
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  for (const person of world.people) {
    if (!person.alive || (person.role !== 'cop' && person.role !== 'gang')) continue;
    const p = place(person.x, person.y);
    ctx.fillStyle = person.role === 'cop' ? '#4d8dff' : '#ff4d4d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const heli = world.police.heli;
  if (heli) {
    const p = place(heli.x, heli.y);
    ctx.strokeStyle = flash ? '#ff4d4d' : '#4d8dff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - 5, p.y - 5);
    ctx.lineTo(p.x + 5, p.y + 5);
    ctx.moveTo(p.x + 5, p.y - 5);
    ctx.lineTo(p.x - 5, p.y + 5);
    ctx.stroke();
  }
  ctx.restore();

  for (const marker of world.markers) {
    let dx = (marker.x - focus.x) * zoom;
    let dy = (marker.y - focus.y) * zoom;
    const far = Math.hypot(dx, dy);
    const limit = radius - 5;
    if (far > limit) {
      if (marker.kind === 'service' && far > radius * 2.4) continue;
      dx = (dx / far) * limit;
      dy = (dy / far) * limit;
    }
    drawBlip(ctx, cx + dx, cy + dy, marker, marker.kind === 'enemy' || marker.kind === 'item' ? 3.5 : 6.5);
  }

  // The player's arrow.
  const heading = world.player.vehicle ? world.player.vehicle.angle : world.player.angle;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(heading);
  ctx.fillStyle = '#10131c';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, -7);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const wanted = world.wanted.stars > 0;
  ctx.lineWidth = 4;
  ctx.strokeStyle = wanted ? (flash ? '#ff4d4d' : '#4d8dff') : '#10131c';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#fff4d6';
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#10131c';
  ctx.beginPath();
  ctx.arc(cx, cy - radius, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff4d6';
  ctx.font = '800 11px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - radius + 4);
}

/** The full map screen: the whole city fitted to the window, with every marker and the player. */
export function drawFullMap(ctx, cityMap, world, width, height) {
  const fit = Math.min((width * 0.86) / cityMap.canvas.width, (height * 0.76) / cityMap.canvas.height);
  const mapW = cityMap.canvas.width * fit;
  const mapH = cityMap.canvas.height * fit;
  const x0 = (width - mapW) / 2;
  const y0 = (height - mapH) / 2 + height * 0.03;
  const k = fit * cityMap.scale;
  ctx.fillStyle = 'rgba(10,14,26,0.86)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#10131c';
  ctx.fillRect(x0 - 6, y0 - 6, mapW + 12, mapH + 12);
  ctx.drawImage(cityMap.canvas, x0, y0, mapW, mapH);
  ctx.textAlign = 'center';
  ctx.font = `800 ${Math.round(height * 0.02)}px "Trebuchet MS", sans-serif`;
  const names = [['CORONA HEIGHTS', 32, 20], ['SAWGRASS PARK', 88, 22], ['BARRIO CORAL', 32, 78], ['VISTA CENTRO', 86, 70], ['PALMETTO ROW', 96, 104], ['PLAYA DORADA', 132, 54], ['IRONWHARF', 58, 132], ['ISLA PERLA', 187, 50]];
  for (const [name, tx, ty] of names) {
    const x = x0 + tx * TILE * k;
    const y = y0 + ty * TILE * k;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,19,28,0.8)';
    ctx.strokeText(name, x, y);
    ctx.fillStyle = '#fff4d6';
    ctx.fillText(name, x, y);
  }
  for (const marker of world.markers) drawBlip(ctx, x0 + marker.x * k, y0 + marker.y * k, marker, marker.kind === 'enemy' || marker.kind === 'item' ? 4 : 9);
  const px = x0 + world.focus.x * k;
  const py = y0 + world.focus.y * k;
  ctx.fillStyle = '#10131c';
  ctx.beginPath();
  ctx.arc(px, py, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = Math.floor(world.clock * 4) % 2 === 0 ? '#ffffff' : '#27d3c3';
  ctx.beginPath();
  ctx.arc(px, py, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff4d6';
  ctx.font = `800 ${Math.round(height * 0.045)}px "Trebuchet MS", sans-serif`;
  ctx.fillText('MARAZUL BAY', width / 2, y0 - height * 0.035);
  ctx.font = `600 ${Math.round(height * 0.02)}px "Trebuchet MS", sans-serif`;
  ctx.fillText('S safehouse · G gun shop · P respray · + hospital · gold: mission · M or ESC to close', width / 2, y0 + mapH + height * 0.045);
}
