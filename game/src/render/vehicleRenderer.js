// Draws every vehicle from above, entirely with canvas shapes: body, glass, wheels, lights and
// the details that tell the eleven models apart (taxi sign, police light bar, open-top cabin…).
import { shadeColor } from '../core/mathUtil.js';

const GLASS = '#1f2c3a';

function wheels(ctx, vehicle, length, width, big) {
  const wl = big ? 12 : 9;
  const ww = big ? 6 : 4;
  ctx.fillStyle = '#15161a';
  for (const side of [-1, 1]) {
    ctx.fillRect(-length * 0.32 - wl / 2, side * (width / 2 - (big ? 0 : 1)) - ww / 2, wl, ww);
    ctx.save();
    ctx.translate(length * 0.3, side * (width / 2 - (big ? 0 : 1)));
    ctx.rotate(vehicle.steerShown * 0.5);
    ctx.fillRect(-wl / 2, -ww / 2, wl, ww);
    ctx.restore();
  }
}

function bodyShape(ctx, length, width, noseTaper, tailTaper, radius) {
  const hl = length / 2;
  const hw = width / 2;
  ctx.beginPath();
  ctx.moveTo(-hl + radius, -hw + tailTaper);
  ctx.lineTo(hl - radius * 1.6, -hw + noseTaper * 0.4);
  ctx.quadraticCurveTo(hl, -hw + noseTaper, hl, -hw + noseTaper + radius);
  ctx.lineTo(hl, hw - noseTaper - radius);
  ctx.quadraticCurveTo(hl, hw - noseTaper, hl - radius * 1.6, hw - noseTaper * 0.4);
  ctx.lineTo(-hl + radius, hw - tailTaper);
  ctx.quadraticCurveTo(-hl, hw - tailTaper, -hl, hw - tailTaper - radius);
  ctx.lineTo(-hl, -hw + tailTaper + radius);
  ctx.quadraticCurveTo(-hl, -hw + tailTaper, -hl + radius, -hw + tailTaper);
  ctx.closePath();
}

function cabin(ctx, x0, x1, width, roofColor, windscreen, rear) {
  const hw = width / 2 - 2.5;
  ctx.fillStyle = GLASS;
  ctx.beginPath();
  ctx.moveTo(x0 - rear, -hw + 1);
  ctx.lineTo(x1 + windscreen, -hw);
  ctx.lineTo(x1 + windscreen, hw);
  ctx.lineTo(x0 - rear, hw - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(160,220,255,0.28)';
  ctx.fillRect(x1 + windscreen - 4, -hw + 1.5, 2.5, hw * 2 - 3);
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.roundRect(x0, -hw + 1.2, x1 - x0, hw * 2 - 2.4, 3);
  ctx.fill();
}

function lightBar(ctx, vehicle, clock, x) {
  const flash = vehicle.siren ? Math.floor(clock * 7) % 2 : -1;
  ctx.fillStyle = '#22262e';
  ctx.fillRect(x - 3, -9, 6, 18);
  ctx.fillStyle = flash === 0 ? '#ff3b3b' : '#8f2a2a';
  ctx.fillRect(x - 2.5, -8.5, 5, 8);
  ctx.fillStyle = flash === 1 ? '#4d8dff' : '#27407f';
  ctx.fillRect(x - 2.5, 0.5, 5, 8);
}

export function drawVehicleShadow(ctx, vehicle, sky) {
  ctx.save();
  ctx.translate(vehicle.x + sky.shadowX * 6, vehicle.y + sky.shadowY * 8 + 2);
  ctx.rotate(vehicle.angle);
  ctx.beginPath();
  ctx.roundRect(-vehicle.kind.length / 2, -vehicle.kind.width / 2, vehicle.kind.length, vehicle.kind.width, 6);
  ctx.fill();
  ctx.restore();
}

export function drawVehicle(ctx, vehicle, clock, lightsOn) {
  const kind = vehicle.kind;
  const length = kind.length;
  const width = kind.width;
  const body = kind.body;
  const hl = length / 2;
  const hw = width / 2;
  const color = vehicle.wrecked ? '#2b2724' : vehicle.color;
  const dark = shadeColor(color, 0.72);
  const bright = shadeColor(color, 1.18, 0.12, 255, 255, 255);
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.angle);

  wheels(ctx, vehicle, length, width, body === 'buggy' || body === 'armored');
  const taper = body === 'super' ? 3.5 : body === 'van' || body === 'armored' ? 0.5 : 1.8;
  bodyShape(ctx, length, width, taper, body === 'super' ? 0.5 : 1, body === 'van' || body === 'armored' ? 3 : 5);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // A highlight along the middle of the bonnet and boot.
  ctx.fillStyle = bright;
  ctx.fillRect(hl * 0.34, -hw * 0.55, hl * 0.5, hw * 1.1);
  ctx.fillRect(-hl * 0.92, -hw * 0.55, hl * 0.3, hw * 1.1);

  if (body === 'convertible' || body === 'buggy') {
    ctx.fillStyle = body === 'buggy' ? '#2a2c31' : '#5b3a29';
    ctx.beginPath();
    ctx.roundRect(-hl * 0.5, -hw + 3, hl * 0.82, width - 6, 3);
    ctx.fill();
    ctx.fillStyle = '#c9a27a';
    ctx.fillRect(-hl * 0.42, -hw + 4.5, 8, 6);
    ctx.fillRect(-hl * 0.42, hw - 10.5, 8, 6);
    ctx.fillStyle = GLASS;
    ctx.fillRect(hl * 0.3, -hw + 3, 3, width - 6);
    if (vehicle.driver && !vehicle.wrecked) {
      ctx.fillStyle = vehicle.driver === 'player' ? '#16130f' : '#3b2a1e';
      ctx.beginPath();
      ctx.arc(-hl * 0.18, -hw * 0.42, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (body === 'buggy') {
      ctx.strokeStyle = '#d7dbe0';
      ctx.lineWidth = 2;
      ctx.strokeRect(-hl * 0.5, -hw + 3, hl * 0.82, width - 6);
    }
  } else if (body === 'van' || body === 'armored') {
    cabin(ctx, -hl + 4, hl * 0.42, width, vehicle.wrecked ? '#24211f' : shadeColor(color, 1.08), 7, 0);
    if (body === 'armored' && !vehicle.wrecked) {
      ctx.fillStyle = '#e8edf2';
      ctx.font = '700 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MBPD', -hl * 0.25, 2.5);
      lightBar(ctx, vehicle, clock, hl * 0.22);
    }
  } else if (body === 'limo') {
    cabin(ctx, -hl * 0.72, hl * 0.42, width, shadeColor(color, 1.1), 6, 5);
    ctx.fillStyle = GLASS;
    for (let n = 0; n < 4; n += 1) {
      ctx.fillRect(-hl * 0.62 + n * 10, -hw + 1.6, 7, 2);
      ctx.fillRect(-hl * 0.62 + n * 10, hw - 3.6, 7, 2);
    }
  } else {
    const rear = body === 'hatch' ? 3 : body === 'super' ? 8 : 5;
    const x0 = body === 'hatch' ? -hl * 0.62 : body === 'super' ? -hl * 0.42 : -hl * 0.48;
    cabin(ctx, x0, hl * 0.16, width, vehicle.wrecked ? '#24211f' : shadeColor(color, 1.1), body === 'super' ? 9 : 7, rear);
    if (body === 'muscle' && !vehicle.wrecked) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-hl + 1, -3.4, length - 2, 2.2);
      ctx.fillRect(-hl + 1, 1.2, length - 2, 2.2);
    }
    if (body === 'super') {
      ctx.fillStyle = dark;
      ctx.fillRect(-hl - 1, -hw + 1, 4, width - 2);
    }
    if (body === 'taxi' && !vehicle.wrecked) {
      ctx.fillStyle = '#1a1a1a';
      for (let n = 0; n < 6; n += 1) {
        ctx.fillRect(-hl * 0.7 + n * 6, -hw + 0.6, 3, 2);
        ctx.fillRect(-hl * 0.7 + n * 6 + 3, hw - 2.6, 3, 2);
      }
      ctx.fillStyle = lightsOn ? '#fff7c2' : '#fff1a8';
      ctx.fillRect(-7, -5, 6, 10);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-5, -4, 2, 8);
    }
    if (body === 'police' && !vehicle.wrecked) {
      ctx.fillStyle = '#1f3b73';
      ctx.fillRect(hl * 0.36, -hw + 1.5, hl * 0.5, width - 3);
      ctx.fillRect(-hl * 0.94, -hw + 1.5, hl * 0.34, width - 3);
      lightBar(ctx, vehicle, clock, -hl * 0.14);
    }
  }

  if (!vehicle.wrecked) {
    const braking = vehicle.throttle < 0 || vehicle.handbrake;
    ctx.fillStyle = lightsOn ? '#fffbe0' : '#f3edd0';
    ctx.fillRect(hl - 3, -hw + 2, 3, 4.5);
    ctx.fillRect(hl - 3, hw - 6.5, 3, 4.5);
    ctx.fillStyle = braking ? '#ff3030' : lightsOn ? '#d62828' : '#9c1f1f';
    ctx.fillRect(-hl, -hw + 2, 2.5, 4.5);
    ctx.fillRect(-hl, hw - 6.5, 2.5, 4.5);
    const hurt = 1 - vehicle.health / kind.health;
    if (hurt > 0.3) {
      ctx.fillStyle = `rgba(20,18,16,${Math.min(0.6, hurt * 0.6)})`;
      ctx.fillRect(hl * 0.3, -hw + 2, hl * 0.6, width - 4);
    }
  }
  ctx.restore();
}
