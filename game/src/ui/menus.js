// The menus drawn over the game: the title screen, the pause menu with its statistics, the
// controls sheet and the Brine & Barrel shop counter.
import { formatMoney } from '../core/mathUtil.js';
import { WEAPONS } from '../combat/weapons.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { CONCH_COUNT } from '../world/pickups.js';
import { SHOP_ITEMS, shopPrice } from '../world/services.js';

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';
const DISPLAY = '"Arial Black", "Trebuchet MS", sans-serif';
const CREAM = '#fff4d6';

export const TITLE_ITEMS = ['NEW GAME', 'CONTINUE', 'CONTROLS'];
export const PAUSE_ITEMS = ['RESUME', 'CITY MAP', 'CONTROLS', 'SAVE GAME', 'QUIT TO TITLE'];

export const CONTROL_LINES = [
  ['W A S D / arrows', 'Walk · steer, accelerate, brake'],
  ['Mouse', 'Aim'],
  ['Left click / Space', 'Attack · Space is the handbrake when driving'],
  ['Shift', 'Sprint'],
  ['F or E', 'Steal, enter or leave a vehicle'],
  ['Q · 1-5 · wheel', 'Switch weapon'],
  ['R', 'Next radio station (in a vehicle)'],
  ['H', 'Horn'],
  ['G', 'Bay Cab fares (in a taxi)'],
  ['Enter', 'Use a shop or safehouse · next line of dialogue'],
  ['M', 'City map'],
  ['F5', 'Quick save'],
  ['Esc / P', 'Pause'],
];

function menuList(ctx, items, index, x, y, step, size, disabled) {
  items.forEach((item, n) => {
    const selected = n === index;
    ctx.font = `800 ${Math.round(size)}px ${FONT}`;
    const off = disabled && disabled(n);
    if (selected) {
      const w = ctx.measureText(item).width;
      ctx.fillStyle = '#ff5fa2';
      ctx.fillRect(x - 18, y + n * step - size * 0.86, w + 36, size * 1.24);
    }
    ctx.fillStyle = off ? 'rgba(255,244,214,0.35)' : selected ? '#10131c' : CREAM;
    ctx.fillText(item, x, y + n * step);
  });
}

/** The title screen, drawn over the living city behind it. */
export function drawTitle(ctx, width, height, index, saveExists, clock) {
  const u = height / 720;
  const shade = ctx.createLinearGradient(0, 0, width * 0.75, 0);
  shade.addColorStop(0, 'rgba(12,10,32,0.9)');
  shade.addColorStop(0.55, 'rgba(40,14,60,0.45)');
  shade.addColorStop(1, 'rgba(255,120,80,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

  const x = 70 * u;
  // A setting sun behind the logo.
  const sunY = 196 * u;
  const sun = ctx.createLinearGradient(0, sunY - 110 * u, 0, sunY + 110 * u);
  sun.addColorStop(0, '#ffd166');
  sun.addColorStop(1, '#ff5fa2');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(x + 330 * u, sunY, 112 * u, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(12,10,32,0.92)';
  for (let n = 0; n < 5; n += 1) ctx.fillRect(x + 200 * u, sunY - (16 + n * 20) * u, 260 * u, (2 + n * 1.2) * u);

  ctx.textAlign = 'left';
  ctx.font = `italic 900 ${Math.round(104 * u)}px ${DISPLAY}`;
  const logo = ctx.createLinearGradient(0, 150 * u, 0, 330 * u);
  logo.addColorStop(0, '#fff4d6');
  logo.addColorStop(0.5, '#ffc94a');
  logo.addColorStop(1, '#ff5fa2');
  ctx.lineJoin = 'round';
  ctx.lineWidth = 12 * u;
  ctx.strokeStyle = '#10131c';
  ctx.strokeText('LOW TIDE', x, 250 * u);
  ctx.strokeText('KINGS', x, 342 * u);
  ctx.fillStyle = logo;
  ctx.fillText('LOW TIDE', x, 250 * u);
  ctx.fillText('KINGS', x, 342 * u);
  ctx.font = `800 ${Math.round(22 * u)}px ${FONT}`;
  ctx.fillStyle = '#27d3c3';
  ctx.fillText('A MARAZUL BAY CRIME STORY', x + 6 * u, 382 * u);

  menuList(ctx, TITLE_ITEMS, index, x + 24 * u, 460 * u, 50 * u, 30 * u, (n) => n === 1 && !saveExists);
  ctx.font = `600 ${Math.round(15 * u)}px ${FONT}`;
  ctx.fillStyle = `rgba(255,244,214,${0.6 + 0.3 * Math.sin(clock * 3)})`;
  ctx.fillText('W / S choose  ·  ENTER select', x + 6 * u, 640 * u);
  ctx.fillStyle = 'rgba(255,244,214,0.6)';
  ctx.fillText('Steal cars, outrun the MBPD, save the boatyard. Keyboard and mouse.', x + 6 * u, 668 * u);
}

function backdrop(ctx, width, height, title) {
  const u = height / 720;
  ctx.fillStyle = 'rgba(10,12,28,0.82)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'left';
  ctx.font = `italic 900 ${Math.round(58 * u)}px ${DISPLAY}`;
  ctx.fillStyle = '#ffc94a';
  ctx.fillText(title, 80 * u, 120 * u);
  ctx.fillStyle = '#ff5fa2';
  ctx.fillRect(80 * u, 136 * u, 220 * u, 5 * u);
  return u;
}

export function drawPause(ctx, width, height, index, world) {
  const u = backdrop(ctx, width, height, 'PAUSED');
  menuList(ctx, PAUSE_ITEMS, index, 98 * u, 220 * u, 52 * u, 30 * u, (n) => n === 3 && (world.mission !== null || world.wanted.stars > 0));
  const x = width - 420 * u;
  ctx.fillStyle = 'rgba(16,19,28,0.8)';
  ctx.beginPath();
  ctx.roundRect(x, 170 * u, 340 * u, 300 * u, 14 * u);
  ctx.fill();
  ctx.font = `800 ${Math.round(18 * u)}px ${FONT}`;
  ctx.fillStyle = '#27d3c3';
  ctx.fillText("DANI'S MARAZUL BAY", x + 24 * u, 206 * u);
  const next = STORY_MISSIONS[world.progress];
  const rows = [
    ['Story', `${world.progress} / ${STORY_MISSIONS.length}`],
    ['Next job', next ? next.title : 'All done'],
    ['Cash', formatMoney(world.money)],
    ['Golden conchs', `${world.stats.conchs.length} / ${CONCH_COUNT}`],
    ['Cab fares', String(world.stats.fares)],
    ['Takedowns', String(world.stats.kills)],
  ];
  ctx.font = `600 ${Math.round(17 * u)}px ${FONT}`;
  rows.forEach(([label, value], n) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,244,214,0.7)';
    ctx.fillText(label, x + 24 * u, (246 + n * 36) * u);
    ctx.textAlign = 'right';
    ctx.fillStyle = CREAM;
    ctx.fillText(value, x + 316 * u, (246 + n * 36) * u);
  });
  ctx.textAlign = 'left';
  ctx.font = `600 ${Math.round(14 * u)}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,244,214,0.6)';
  ctx.fillText('Saving needs a quiet moment: no mission running and no wanted level.', 98 * u, height - 60 * u);
}

export function drawControls(ctx, width, height) {
  const u = backdrop(ctx, width, height, 'CONTROLS');
  CONTROL_LINES.forEach(([keys, action], n) => {
    const y = (196 + n * 35) * u;
    ctx.font = `800 ${Math.round(17 * u)}px ${FONT}`;
    ctx.fillStyle = '#27d3c3';
    ctx.fillText(keys, 98 * u, y);
    ctx.font = `600 ${Math.round(17 * u)}px ${FONT}`;
    ctx.fillStyle = CREAM;
    ctx.fillText(action, 330 * u, y);
  });
  ctx.font = `600 ${Math.round(14 * u)}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,244,214,0.6)';
  ctx.fillText('ESC or ENTER to go back', 98 * u, height - 40 * u);
}

export function drawShop(ctx, width, height, world) {
  const u = backdrop(ctx, width, height, 'BRINE & BARREL');
  ctx.font = `600 ${Math.round(17 * u)}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,244,214,0.75)';
  ctx.fillText('"Bait, tackle and things that go bang since 1978."', 82 * u, 172 * u);
  SHOP_ITEMS.forEach((item, n) => {
    const y = (236 + n * 62) * u;
    const selected = n === world.shop.index;
    ctx.fillStyle = selected ? 'rgba(255,95,162,0.9)' : 'rgba(16,19,28,0.75)';
    ctx.beginPath();
    ctx.roundRect(82 * u, y - 34 * u, 640 * u, 52 * u, 10 * u);
    ctx.fill();
    const weapon = item.weapon ? WEAPONS[item.weapon] : null;
    const owned = weapon && world.inventory.owned[item.weapon];
    const name = weapon ? (owned ? `${weapon.name} ammo ×${weapon.pack}` : weapon.name) : item.name;
    const price = shopPrice(world, item);
    ctx.textAlign = 'left';
    ctx.font = `800 ${Math.round(20 * u)}px ${FONT}`;
    ctx.fillStyle = selected ? '#10131c' : CREAM;
    ctx.fillText(name, 104 * u, y);
    ctx.font = `600 ${Math.round(13 * u)}px ${FONT}`;
    ctx.fillText(weapon ? `${owned ? `you hold ${world.inventory.ammo[item.weapon] ?? 0} rounds` : `damage ${weapon.damage}${weapon.pellets > 1 ? ` ×${weapon.pellets}` : ''} · ${weapon.auto ? 'automatic' : 'single shot'}`}` : 'stops three quarters of every hit', 104 * u, y + 15 * u);
    ctx.textAlign = 'right';
    ctx.font = `800 ${Math.round(20 * u)}px ${FONT}`;
    ctx.fillStyle = world.money >= price ? (selected ? '#10131c' : '#7dff9b') : '#ff4d4d';
    ctx.fillText(formatMoney(price), 700 * u, y + 4 * u);
  });
  ctx.textAlign = 'left';
  ctx.font = `800 ${Math.round(24 * u)}px ${FONT}`;
  ctx.fillStyle = '#7dff9b';
  ctx.fillText(`Cash ${formatMoney(world.money)}`, 82 * u, height - 90 * u);
  ctx.font = `600 ${Math.round(14 * u)}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,244,214,0.6)';
  ctx.fillText('W / S choose  ·  ENTER buy  ·  ESC leave', 82 * u, height - 50 * u);
}
