// Draws the city's furniture and greenery: palms, trees, street lamps and dock cranes that lean
// with the perspective, and the low things (pools, fountains, benches, parasols, boats).
import { LEAN } from '../core/config.js';
import { shadeColor } from '../core/mathUtil.js';

const HEIGHTS = { palm: 78, tree: 40, lamp: 56, crane: 210, umbrella: 16 };
const UMBRELLA = ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0', '#ff9f1c', '#ffffff'];

export function isTallProp(type) {
  return HEIGHTS[type] !== undefined;
}

function shade(hex, factor, sky) {
  return shadeColor(hex, factor * sky.light, sky.darkness * 0.35, sky.red, sky.green, sky.blue);
}

export function drawPropShadow(ctx, prop, sky) {
  const height = HEIGHTS[prop.type];
  if (!height) return;
  const x = prop.x + sky.shadowX * height * 0.5;
  const y = prop.y + sky.shadowY * height * 0.5;
  ctx.beginPath();
  if (prop.type === 'palm') {
    for (let n = 0; n < 7; n += 1) {
      const a = prop.seed * 6 + (n / 7) * Math.PI * 2;
      ctx.ellipse(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 13, 4.5, a, 0, Math.PI * 2);
    }
  } else if (prop.type === 'tree') ctx.arc(x, y, 19, 0, Math.PI * 2);
  else if (prop.type === 'umbrella') ctx.arc(x, y, 15, 0, Math.PI * 2);
  else if (prop.type === 'lamp') ctx.ellipse((prop.x + x) / 2, (prop.y + y) / 2, Math.hypot(x - prop.x, y - prop.y) / 2 + 2, 2, Math.atan2(y - prop.y, x - prop.x), 0, Math.PI * 2);
  else ctx.rect(x - 60, y - 8, 120, 16);
  ctx.fill();
}

/** Flat props, drawn on the ground before people and vehicles. */
export function drawLowProp(ctx, prop, sky, clock) {
  const { x, y, type } = prop;
  if (type === 'pool') {
    ctx.fillStyle = '#f4ead7';
    ctx.beginPath();
    ctx.roundRect(x - 5, y - 5, prop.w + 10, prop.h + 10, 12);
    ctx.fill();
    ctx.fillStyle = '#38c6e6';
    ctx.beginPath();
    ctx.roundRect(x, y, prop.w, prop.h, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let n = 0; n < 3; n += 1) {
      const wy = y + prop.h * (0.25 + n * 0.25) + Math.sin(clock * 1.5 + n + prop.seed * 6) * 2;
      ctx.moveTo(x + prop.w * 0.15, wy);
      ctx.quadraticCurveTo(x + prop.w * 0.5, wy - 4, x + prop.w * 0.85, wy);
    }
    ctx.stroke();
  } else if (type === 'fountain') {
    ctx.fillStyle = '#d9d2c5';
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4fd0e8';
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 8 + ((clock * 9 + prop.seed * 10) % 16), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'bench') {
    ctx.fillStyle = '#8a5a3b';
    ctx.fillRect(x - 13, y - 4, 26, 8);
    ctx.fillStyle = '#6d4329';
    ctx.fillRect(x - 13, y - 4, 26, 2.5);
  } else if (type === 'bush') {
    ctx.fillStyle = '#3f9b57';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.arc(x + 7, y + 3, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = prop.seed < 0.4 ? '#ff7eb6' : '#57b86c';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'planter') {
    ctx.fillStyle = '#b9aa94';
    ctx.fillRect(x - 12, y - 12, 24, 24);
    ctx.fillStyle = '#3f9b57';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#62c06f';
    ctx.beginPath();
    ctx.arc(x - 2, y - 3, 5.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'towel') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(prop.seed * 3);
    ctx.fillStyle = UMBRELLA[Math.floor(prop.seed * UMBRELLA.length)];
    ctx.fillRect(-9, -5, 18, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-9, -1.5, 18, 3);
    ctx.restore();
  } else if (type === 'hydrant') {
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 6, y - 1.5, 12, 3);
  } else if (type === 'bin') {
    ctx.fillStyle = '#3d5a50';
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22352f';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'boat') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 2 + (prop.seed - 0.5) * 0.3);
    ctx.fillStyle = '#f7f7f2';
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.quadraticCurveTo(10, -13, -22, -10);
    ctx.lineTo(-22, 10);
    ctx.quadraticCurveTo(10, 13, 26, 0);
    ctx.fill();
    ctx.fillStyle = prop.seed < 0.5 ? '#27d3c3' : '#ff7b54';
    ctx.fillRect(-18, -6, 22, 12);
    ctx.fillStyle = '#1f2c3a';
    ctx.fillRect(4, -5, 5, 10);
    ctx.restore();
  }
}

/** Tall props, drawn with the buildings so that they lean away from the view centre. */
export function drawTallProp(ctx, prop, camX, camY, sky, clock) {
  const height = HEIGHTS[prop.type];
  const top = 1 + height * LEAN;
  const tx = camX + (prop.x - camX) * top;
  const ty = camY + (prop.y - camY) * top;
  if (prop.type === 'palm') {
    ctx.strokeStyle = shade('#8c6a45', 1, sky);
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(prop.x, prop.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    const sway = Math.sin(clock * 1.1 + prop.seed * 20) * 0.07;
    for (let n = 0; n < 8; n += 1) {
      const a = prop.seed * 6 + (n / 8) * Math.PI * 2 + sway;
      ctx.fillStyle = shade(n % 2 === 0 ? '#2e9e58' : '#46b96a', 1, sky);
      ctx.beginPath();
      ctx.ellipse(tx + Math.cos(a) * 13, ty + Math.sin(a) * 13, 15, 4.6, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = shade('#6b4a2b', 1, sky);
    ctx.beginPath();
    ctx.arc(tx, ty, 3.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.type === 'tree') {
    ctx.fillStyle = shade('#2f8a4c', 1, sky);
    ctx.beginPath();
    ctx.arc(tx, ty, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade('#49ab63', 1, sky);
    ctx.beginPath();
    ctx.arc(tx - 5, ty - 5, 12, 0, Math.PI * 2);
    ctx.arc(tx + 8, ty + 4, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.type === 'lamp') {
    ctx.strokeStyle = shade('#59616b', 1, sky);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(prop.x, prop.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = sky.lampsOn ? '#fff3c4' : shade('#d9dee4', 1, sky);
    ctx.beginPath();
    ctx.arc(tx, ty, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.type === 'umbrella') {
    const color = UMBRELLA[Math.floor(prop.seed * UMBRELLA.length)];
    for (let n = 0; n < 8; n += 1) {
      ctx.fillStyle = shade(n % 2 === 0 ? color : '#ffffff', 1, sky);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.arc(tx, ty, 15, (n / 8) * Math.PI * 2, ((n + 1) / 8) * Math.PI * 2);
      ctx.fill();
    }
  } else if (prop.type === 'crane') {
    ctx.strokeStyle = shade('#e0a030', 1, sky);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(prop.x - 22, prop.y);
    ctx.lineTo(tx, ty);
    ctx.moveTo(prop.x + 22, prop.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(tx - 40, ty - 150);
    ctx.lineTo(tx + 14, ty + 50);
    ctx.stroke();
    ctx.fillStyle = shade('#c2534a', 1, sky);
    ctx.fillRect(tx - 12, ty - 12, 24, 24);
  }
}
