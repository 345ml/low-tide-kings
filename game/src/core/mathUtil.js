// Small geometry helpers shared by the simulation and the renderers.

export const TAU = Math.PI * 2;

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** The signed shortest turn from angle `from` to angle `to`, in (-PI, PI]. */
export function angleDiff(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return d;
}

/** Move `value` toward `target` by at most `delta`. */
export function approach(value, target, delta) {
  if (value < target) return Math.min(target, value + delta);
  return Math.max(target, value - delta);
}

/** Turn `angle` toward `target` by at most `delta` radians. */
export function turnToward(angle, target, delta) {
  const d = angleDiff(angle, target);
  return angle + clamp(d, -delta, delta);
}

/**
 * Where along the segment (x0,y0)-(x1,y1) it first enters the circle, as a fraction 0..1;
 * -1 when it misses.
 */
export function segmentCircle(x0, y0, x1, y1, cx, cy, radius) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return -1;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  if (c <= 0) return 0;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

/** Format a whole number of dollars: 12500 -> "$12,500". */
export function formatMoney(amount) {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

/** Multiply a #rrggbb colour's brightness by `factor`, tinting toward (tr,tg,tb) by `tint`. */
export function shadeColor(hex, factor, tint = 0, tr = 0, tg = 0, tb = 0) {
  const n = Number.parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) * factor;
  let g = ((n >> 8) & 255) * factor;
  let b = (n & 255) * factor;
  r = clamp(Math.round(r + (tr - r) * tint), 0, 255);
  g = clamp(Math.round(g + (tg - g) * tint), 0, 255);
  b = clamp(Math.round(b + (tb - b) * tint), 0, 255);
  return `rgb(${r},${g},${b})`;
}
