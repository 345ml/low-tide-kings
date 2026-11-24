// Short-lived visual effects and how they are drawn: smoke, fire, sparks, blood, bullet tracers,
// muzzle flashes, explosions, tyre marks, stains on the ground and floating text.
import { rand, randRange } from '../core/random.js';

const MAX_PARTICLES = 700;
const MAX_SKIDS = 900;
const MAX_DECALS = 90;

export function createEffects() {
  const fx = {
    particles: [],
    tracers: [],
    flashes: [],
    texts: [],
    skids: [],
    decals: [],
    add(kind, x, y, vx, vy, life, size, grow, color) {
      if (fx.particles.length >= MAX_PARTICLES) fx.particles.shift();
      fx.particles.push({ kind, x, y, vx, vy, life, age: 0, size, grow, color });
    },
    blood(x, y, angle) {
      for (let n = 0; n < 6; n += 1) {
        const a = angle + randRange(-0.7, 0.7);
        const speed = randRange(30, 150);
        fx.add('blood', x, y, Math.cos(a) * speed, Math.sin(a) * speed, randRange(0.25, 0.5), randRange(1.5, 3), 0, '#b3122a');
      }
    },
    sparks(x, y, count) {
      for (let n = 0; n < count; n += 1) {
        const a = rand() * Math.PI * 2;
        const speed = randRange(60, 240);
        fx.add('spark', x, y, Math.cos(a) * speed, Math.sin(a) * speed, randRange(0.12, 0.3), 1.6, 0, '#ffe08a');
      }
    },
    smoke(x, y, size, dark) {
      fx.add('smoke', x + randRange(-4, 4), y + randRange(-4, 4), randRange(-14, 14), randRange(-34, -12), randRange(0.8, 1.6), size, size * 1.4, dark ? '#1c1c1f' : '#8a8f96');
    },
    dust(x, y) {
      fx.add('smoke', x, y, randRange(-20, 20), randRange(-20, 20), randRange(0.3, 0.6), 4, 9, '#cbb994');
    },
    fire(x, y, size) {
      fx.add('fire', x + randRange(-6, 6), y + randRange(-6, 6), randRange(-16, 16), randRange(-52, -20), randRange(0.25, 0.55), size, -size * 0.8, rand() < 0.5 ? '#ffb347' : '#ff6b2c');
    },
    explosion(x, y, radius) {
      fx.flashes.push({ x, y, radius: radius * 1.5, age: 0, life: 0.45, color: '255,190,90' });
      for (let n = 0; n < 26; n += 1) {
        const a = rand() * Math.PI * 2;
        const speed = randRange(40, 260);
        fx.add('fire', x, y, Math.cos(a) * speed, Math.sin(a) * speed, randRange(0.3, 0.8), randRange(8, 18), -6, rand() < 0.5 ? '#ffd27a' : '#ff7b2c');
      }
      for (let n = 0; n < 16; n += 1) fx.add('smoke', x + randRange(-30, 30), y + randRange(-30, 30), randRange(-30, 30), randRange(-70, -20), randRange(1.2, 2.6), randRange(10, 20), 22, '#1c1c1f');
      fx.sparks(x, y, 18);
    },
    tracer(x0, y0, x1, y1) {
      fx.tracers.push({ x0, y0, x1, y1, age: 0, life: 0.07 });
    },
    muzzle(x, y, angle) {
      fx.flashes.push({ x, y, radius: 26, age: 0, life: 0.06, color: '255,230,150', angle });
    },
    text(x, y, text, color) {
      fx.texts.push({ x, y, text, color, age: 0, life: 1.4 });
    },
    skid(x, y, angle, strength) {
      if (fx.skids.length >= MAX_SKIDS) fx.skids.shift();
      fx.skids.push({ x, y, angle, strength });
    },
    decal(x, y, kind) {
      if (fx.decals.length >= MAX_DECALS) fx.decals.shift();
      fx.decals.push({ x, y, kind, size: kind === 'scorch' ? randRange(46, 64) : randRange(11, 17), seed: rand() * 6 });
    },
  };
  return fx;
}

function ageList(list, dt) {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    list[index].age += dt;
    if (list[index].age >= list[index].life) list.splice(index, 1);
  }
}

export function stepEffects(fx, dt) {
  for (let index = fx.particles.length - 1; index >= 0; index -= 1) {
    const p = fx.particles[index];
    p.age += dt;
    if (p.age >= p.life) {
      fx.particles.splice(index, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const drag = Math.exp(-(p.kind === 'smoke' ? 1.2 : 3.5) * dt);
    p.vx *= drag;
    p.vy *= drag;
    p.size = Math.max(0.5, p.size + p.grow * dt);
  }
  ageList(fx.tracers, dt);
  ageList(fx.flashes, dt);
  ageList(fx.texts, dt);
}

function inside(bounds, x, y) {
  return x > bounds.x0 && x < bounds.x1 && y > bounds.y0 && y < bounds.y1;
}

/** Stains and tyre marks, drawn on the ground under everything that moves. */
export function drawGroundEffects(ctx, fx, bounds) {
  ctx.fillStyle = 'rgba(20,20,24,0.34)';
  for (const skid of fx.skids) {
    if (!inside(bounds, skid.x, skid.y)) continue;
    ctx.save();
    ctx.translate(skid.x, skid.y);
    ctx.rotate(skid.angle);
    ctx.globalAlpha = skid.strength;
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const decal of fx.decals) {
    if (!inside(bounds, decal.x, decal.y)) continue;
    ctx.fillStyle = decal.kind === 'scorch' ? 'rgba(15,12,10,0.5)' : 'rgba(120,10,24,0.6)';
    ctx.beginPath();
    for (let n = 0; n < 9; n += 1) {
      const a = (n / 9) * Math.PI * 2;
      const r = decal.size * (0.7 + 0.3 * Math.sin(decal.seed + n * 2.4));
      ctx.lineTo(decal.x + Math.cos(a) * r, decal.y + Math.sin(a) * r * 0.8);
    }
    ctx.fill();
  }
}

/** Particles, tracers and flashes, drawn over the people and vehicles. */
export function drawAirEffects(ctx, fx, bounds) {
  for (const p of fx.particles) {
    if (!inside(bounds, p.x, p.y)) continue;
    const fade = 1 - p.age / p.life;
    ctx.globalAlpha = p.kind === 'smoke' ? fade * 0.5 : fade;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round';
  for (const tracer of fx.tracers) {
    const fade = 1 - tracer.age / tracer.life;
    ctx.strokeStyle = `rgba(255,236,170,${0.85 * fade})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(tracer.x0, tracer.y0);
    ctx.lineTo(tracer.x1, tracer.y1);
    ctx.stroke();
  }
  for (const flash of fx.flashes) {
    if (!inside(bounds, flash.x, flash.y)) continue;
    const fade = 1 - flash.age / flash.life;
    const glow = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, flash.radius);
    glow.addColorStop(0, `rgba(${flash.color},${0.95 * fade})`);
    glow.addColorStop(1, `rgba(${flash.color},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** "+$120" and the like, rising from where they happened. */
export function drawFloatingTexts(ctx, fx) {
  ctx.textAlign = 'center';
  ctx.font = '700 13px "Trebuchet MS", "Segoe UI", sans-serif';
  for (const text of fx.texts) {
    const t = text.age / text.life;
    ctx.globalAlpha = 1 - t * t;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(text.text, text.x + 1, text.y - 18 - t * 30 + 1);
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y - 18 - t * 30);
  }
  ctx.globalAlpha = 1;
}
