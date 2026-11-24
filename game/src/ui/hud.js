// The heads-up display drawn over the world: minimap, health and armour, money, wanted stars,
// clock and district, weapon and ammunition, speedometer, the mission objective and timer,
// prompts, messages, dialogue, mission banners and the wasted / busted screens.
import { PLAYER_TUNING } from '../core/config.js';
import { clamp, formatMoney } from '../core/mathUtil.js';
import { districtAt } from '../city/districts.js';
import { vehicleSpeed } from '../entities/vehicle.js';
import { nearestEnterable } from '../entities/player.js';
import { WEAPONS } from '../combat/weapons.js';
import { searchDuration } from '../police/wantedSystem.js';
import { clockText } from '../world/dayNight.js';
import { drawMinimap } from './minimap.js';

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';
const INK = 'rgba(16,19,28,0.78)';
const CREAM = '#fff4d6';

function panel(ctx, x, y, w, h, radius = 10) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

function outlined(ctx, text, x, y, color) {
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(16,19,28,0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function star(ctx, x, y, radius) {
  ctx.beginPath();
  for (let n = 0; n < 10; n += 1) {
    const a = -Math.PI / 2 + (n * Math.PI) / 5;
    const r = n % 2 === 0 ? radius : radius * 0.45;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function bar(ctx, x, y, w, h, fraction, color) {
  ctx.fillStyle = 'rgba(16,19,28,0.85)';
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(fraction, 0, 1), h);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = attempt;
  }
  if (line) lines.push(line);
  return lines;
}

function drawWantedStars(ctx, world, right, y, u) {
  const wanted = world.wanted;
  const searching = wanted.stars > 0 && !wanted.seen;
  const blink = searching && Math.floor(world.clock * 5) % 2 === 0;
  for (let n = 0; n < 5; n += 1) {
    const x = right - (4 - n) * 30 * u - 14 * u;
    const lit = n < wanted.stars;
    star(ctx, x, y, 13 * u * (lit && wanted.pulse > 0 ? 1 + wanted.pulse * 0.4 : 1));
    ctx.fillStyle = lit ? (blink ? 'rgba(255,201,74,0.35)' : '#ffc94a') : 'rgba(16,19,28,0.55)';
    ctx.fill();
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = lit ? '#10131c' : 'rgba(255,244,214,0.5)';
    ctx.stroke();
  }
  if (searching) {
    const left = 1 - wanted.hidden / searchDuration(wanted.stars);
    bar(ctx, right - 148 * u, y + 20 * u, 146 * u, 5 * u, left, '#4d8dff');
  }
}

function drawVitals(ctx, world, x, y, w, u) {
  const player = world.player;
  bar(ctx, x, y, w, 9 * u, player.health / PLAYER_TUNING.maxHealth, player.health < 30 ? '#ff4d4d' : '#57e389');
  bar(ctx, x, y + 15 * u, w, 6 * u, player.armor / PLAYER_TUNING.maxArmor, '#62b6ff');
}

function drawWeaponPanel(ctx, world, right, bottom, u) {
  const inventory = world.inventory;
  const weapon = WEAPONS[inventory.current];
  const vehicle = world.player.vehicle;
  const w = 230 * u;
  const h = (vehicle ? 112 : 62) * u;
  const x = right - w;
  const y = bottom - h;
  panel(ctx, x, y, w, h);
  ctx.textAlign = 'right';
  ctx.font = `800 ${Math.round(17 * u)}px ${FONT}`;
  ctx.fillStyle = CREAM;
  ctx.fillText(weapon.name.toUpperCase(), right - 14 * u, y + 25 * u);
  ctx.font = `700 ${Math.round(15 * u)}px ${FONT}`;
  ctx.fillStyle = weapon.melee ? 'rgba(255,244,214,0.6)' : (inventory.ammo[weapon.id] ?? 0) > 0 ? '#ffc94a' : '#ff4d4d';
  ctx.fillText(weapon.melee ? 'Q / 1-5 switch' : `${inventory.ammo[weapon.id] ?? 0} rounds`, right - 14 * u, y + 47 * u);
  // A little silhouette of the weapon.
  ctx.fillStyle = CREAM;
  const gx = x + 16 * u;
  const gy = y + 26 * u;
  if (weapon.melee) {
    ctx.beginPath();
    ctx.roundRect(gx, gy - 9 * u, 24 * u, 20 * u, 6 * u);
    ctx.fill();
  } else {
    const long = weapon.id === 'pistol' ? 26 : weapon.id === 'smg' ? 38 : 56;
    ctx.fillRect(gx, gy - 5 * u, long * u, 7 * u);
    ctx.fillRect(gx + 3 * u, gy, 8 * u, 14 * u);
    if (weapon.id !== 'pistol') ctx.fillRect(gx + 18 * u, gy, 6 * u, 11 * u);
  }
  if (!vehicle) return;
  const mph = Math.round(vehicleSpeed(vehicle) * 0.3);
  ctx.textAlign = 'left';
  ctx.font = `800 ${Math.round(30 * u)}px ${FONT}`;
  ctx.fillStyle = CREAM;
  ctx.fillText(String(mph), x + 14 * u, y + 98 * u);
  const numberWidth = ctx.measureText(String(mph)).width;
  ctx.font = `700 ${Math.round(12 * u)}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,244,214,0.7)';
  ctx.fillText('MPH', x + 20 * u + numberWidth, y + 98 * u);
  ctx.textAlign = 'right';
  ctx.fillStyle = CREAM;
  ctx.font = `700 ${Math.round(13 * u)}px ${FONT}`;
  ctx.fillText(vehicle.kind.name, right - 14 * u, y + 80 * u);
  const health = vehicle.health / vehicle.kind.health;
  bar(ctx, right - 124 * u, y + 90 * u, 110 * u, 7 * u, health, health < 0.35 ? '#ff4d4d' : '#ffb347');
}

function drawObjective(ctx, world, u) {
  if (!world.objective) return;
  const x = 24 * u;
  const y = 24 * u;
  ctx.font = `700 ${Math.round(16 * u)}px ${FONT}`;
  const lines = wrapText(ctx, world.objective, 330 * u);
  const title = world.mission ? world.mission.def.title.toUpperCase() : 'SIDE JOB';
  const h = (38 + lines.length * 21 + (world.missionTimer !== null ? 30 : 0)) * u;
  panel(ctx, x, y, 366 * u, h);
  ctx.fillStyle = '#ffc94a';
  ctx.fillRect(x, y + 10 * u, 5 * u, h - 20 * u);
  ctx.textAlign = 'left';
  ctx.font = `800 ${Math.round(12 * u)}px ${FONT}`;
  ctx.fillStyle = '#ffc94a';
  ctx.fillText(title, x + 18 * u, y + 22 * u);
  ctx.font = `700 ${Math.round(16 * u)}px ${FONT}`;
  ctx.fillStyle = CREAM;
  lines.forEach((line, index) => ctx.fillText(line, x + 18 * u, y + (44 + index * 21) * u));
  if (world.missionTimer !== null) {
    const t = Math.max(0, world.missionTimer);
    const text = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    ctx.font = `800 ${Math.round(22 * u)}px ${FONT}`;
    ctx.fillStyle = t < 20 ? '#ff4d4d' : '#7dff9b';
    ctx.fillText(text, x + 18 * u, y + h - 12 * u);
  }
}

function drawDialogue(ctx, world, width, height, u) {
  const dialogue = world.dialogue;
  if (!dialogue) return;
  const [speaker, text] = dialogue.lines[dialogue.index];
  const w = Math.min(width * 0.7, 820 * u);
  const x = (width - w) / 2;
  ctx.font = `600 ${Math.round(19 * u)}px ${FONT}`;
  const lines = wrapText(ctx, text, w - 48 * u);
  const h = (58 + lines.length * 26) * u;
  const y = height - h - 40 * u;
  panel(ctx, x, y, w, h, 14 * u);
  ctx.fillStyle = '#ff5fa2';
  ctx.fillRect(x, y, w, 4 * u);
  ctx.textAlign = 'left';
  ctx.font = `800 ${Math.round(15 * u)}px ${FONT}`;
  ctx.fillStyle = speaker.startsWith('Dani') ? '#ff9a5c' : '#27d3c3';
  ctx.fillText(speaker.toUpperCase(), x + 24 * u, y + 30 * u);
  ctx.font = `600 ${Math.round(19 * u)}px ${FONT}`;
  ctx.fillStyle = CREAM;
  lines.forEach((line, index) => ctx.fillText(line, x + 24 * u, y + (58 + index * 26) * u));
  ctx.textAlign = 'right';
  ctx.font = `700 ${Math.round(12 * u)}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,244,214,0.7)';
  ctx.fillText('ENTER / CLICK  ▶', x + w - 20 * u, y + h - 12 * u);
}

function drawBanner(ctx, world, width, height, u) {
  const banner = world.banner;
  if (!banner) return;
  const fade = clamp(banner.time / 0.6, 0, 1);
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(16,19,28,0.6)';
  ctx.fillRect(0, height * 0.27, width, 108 * u);
  ctx.textAlign = 'center';
  ctx.font = `italic 900 ${Math.round(54 * u)}px "Arial Black", ${FONT}`;
  outlined(ctx, banner.title.toUpperCase(), width / 2, height * 0.27 + 60 * u, banner.color);
  ctx.font = `700 ${Math.round(19 * u)}px ${FONT}`;
  ctx.fillStyle = CREAM;
  ctx.fillText(banner.subtitle, width / 2, height * 0.27 + 92 * u);
  ctx.globalAlpha = 1;
}

function drawRespawn(ctx, world, width, height, u) {
  if (!world.respawn) return;
  const busted = world.respawn.kind === 'busted';
  const t = clamp(1 - world.respawn.timer / 4, 0, 1);
  ctx.fillStyle = busted ? `rgba(20,40,110,${0.25 + t * 0.5})` : `rgba(120,10,20,${0.25 + t * 0.5})`;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.font = `italic 900 ${Math.round(96 * u)}px "Arial Black", ${FONT}`;
  outlined(ctx, busted ? 'BUSTED' : 'WASTED', width / 2, height * 0.5, busted ? '#8fb8ff' : '#ff5a5a');
}

/** Draw the whole HUD for a world being played. */
export function drawHud(ctx, world, cityMap, width, height) {
  const u = height / 720;
  const player = world.player;
  if (world.hurtFlash > 0) {
    const glow = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.8);
    glow.addColorStop(0, 'rgba(255,0,0,0)');
    glow.addColorStop(1, `rgba(255,0,20,${Math.min(0.55, world.hurtFlash * 1.6)})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  // Bottom left: radar, district, vitals.
  const radius = 92 * u;
  const cx = 28 * u + radius;
  const cy = height - 62 * u - radius;
  drawMinimap(ctx, cityMap, world, cx, cy, radius);
  drawVitals(ctx, world, cx - radius, height - 46 * u, radius * 2, u);
  ctx.textAlign = 'left';
  ctx.font = `800 ${Math.round(17 * u)}px ${FONT}`;
  outlined(ctx, districtAt(world.focus.x, world.focus.y).name.toUpperCase(), cx + radius + 14 * u, height - 34 * u, CREAM);

  // Top right: money, stars, clock.
  const right = width - 24 * u;
  ctx.textAlign = 'right';
  ctx.font = `900 ${Math.round(32 * u)}px ${FONT}`;
  outlined(ctx, formatMoney(world.money), right, 46 * u, '#7dff9b');
  drawWantedStars(ctx, world, right, 72 * u, u);
  ctx.textAlign = 'right';
  ctx.font = `700 ${Math.round(15 * u)}px ${FONT}`;
  outlined(ctx, clockText(world.dayTime), right, 122 * u, CREAM);

  drawWeaponPanel(ctx, world, right, height - 24 * u, u);
  drawObjective(ctx, world, u);

  // Prompts and messages.
  let prompt = world.prompt;
  if (!prompt && !player.vehicle && player.alive && !world.dialogue) {
    const vehicle = nearestEnterable(world);
    if (vehicle) prompt = `F  ${vehicle.driver === 'ai' ? 'Jack' : 'Drive'} the ${vehicle.kind.name}`;
  }
  if (!prompt && player.vehicle && player.vehicle.kind.id === 'cab' && !world.taxi.active && !world.mission) prompt = 'G  start Bay Cab fares';
  ctx.textAlign = 'center';
  if (prompt && !world.dialogue) {
    ctx.font = `700 ${Math.round(16 * u)}px ${FONT}`;
    const w = ctx.measureText(prompt).width + 32 * u;
    panel(ctx, width / 2 - w / 2, height - 86 * u, w, 34 * u, 17 * u);
    ctx.fillStyle = CREAM;
    ctx.fillText(prompt, width / 2, height - 63 * u);
  }
  ctx.font = `700 ${Math.round(15 * u)}px ${FONT}`;
  world.toasts.forEach((toast, index) => {
    ctx.globalAlpha = clamp(toast.time, 0, 1);
    outlined(ctx, toast.text, width / 2, height - (104 + (world.toasts.length - 1 - index) * 24) * u, CREAM);
  });
  ctx.globalAlpha = 1;

  drawBanner(ctx, world, width, height, u);
  drawDialogue(ctx, world, width, height, u);
  drawRespawn(ctx, world, width, height, u);
}
