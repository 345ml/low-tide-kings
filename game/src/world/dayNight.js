// The day and night cycle: the clock, how dark and what colour the light is at each hour, where
// shadows fall and when the street lamps come on.
import { DAY_SECONDS } from '../core/config.js';
import { clamp, lerp } from '../core/mathUtil.js';

// [hour, overlay alpha, overlay red, green, blue]
const SKY_KEYS = [
  [0, 0.74, 12, 16, 52],
  [4.8, 0.74, 12, 16, 52],
  [6.3, 0.34, 255, 150, 110],
  [7.8, 0, 255, 220, 180],
  [16.8, 0, 255, 200, 150],
  [18.8, 0.3, 255, 118, 70],
  [20.2, 0.58, 60, 36, 100],
  [21.6, 0.74, 12, 16, 52],
  [24, 0.74, 12, 16, 52],
];

export function stepDayTime(world, dt) {
  world.dayTime = (world.dayTime + (dt * 24) / DAY_SECONDS) % 24;
}

/** Everything the renderers need to know about the light at `hour` (0 to 24). */
export function skyState(hour) {
  let index = 0;
  while (index + 2 < SKY_KEYS.length && hour >= SKY_KEYS[index + 1][0]) index += 1;
  const a = SKY_KEYS[index];
  const b = SKY_KEYS[index + 1];
  const t = clamp((hour - a[0]) / (b[0] - a[0]), 0, 1);
  const darkness = lerp(a[1], b[1], t);
  const sun = clamp((hour - 6) / 13, 0, 1);
  const night = darkness > 0.5;
  return {
    darkness,
    red: Math.round(lerp(a[2], b[2], t)),
    green: Math.round(lerp(a[3], b[3], t)),
    blue: Math.round(lerp(a[4], b[4], t)),
    /** Brightness multiplier for things drawn above the darkness (buildings, roofs). */
    light: 1 - darkness * 0.72,
    /** Shadow offset per unit of height, and how dark shadows are. */
    shadowX: night ? 0.35 : lerp(-1.25, 1.25, sun),
    shadowY: night ? 0.45 : 0.42 + Math.abs(sun - 0.5) * 0.5,
    shadowAlpha: night ? 0.14 : 0.3,
    lampsOn: darkness > 0.25,
    glow: clamp((darkness - 0.2) / 0.5, 0, 1),
  };
}

export function clockText(hour) {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
