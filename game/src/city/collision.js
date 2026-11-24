// Collision against the city: which tile a point is on, moving a circle without entering
// buildings or water, bullet ray casts and line-of-sight checks.
import { MAP_H, MAP_W, T, TILE } from '../core/config.js';

export function tileAt(city, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return T.WATER;
  return city.tiles[ty * MAP_W + tx];
}

/** 0 open ground, 1 building, 2 water (the map's edge counts as water). */
export function solidAt(city, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 2;
  return city.solid[ty * MAP_W + tx];
}

/** True when a circle overlaps any building or water tile. */
export function circleBlocked(city, x, y, radius) {
  const tx0 = Math.floor((x - radius) / TILE);
  const tx1 = Math.floor((x + radius) / TILE);
  const ty0 = Math.floor((y - radius) / TILE);
  const ty1 = Math.floor((y + radius) / TILE);
  for (let ty = ty0; ty <= ty1; ty += 1) {
    for (let tx = tx0; tx <= tx1; tx += 1) {
      const outside = tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H;
      if (!outside && city.solid[ty * MAP_W + tx] === 0) continue;
      const nearX = Math.max(tx * TILE, Math.min(x, (tx + 1) * TILE));
      const nearY = Math.max(ty * TILE, Math.min(y, (ty + 1) * TILE));
      if ((x - nearX) * (x - nearX) + (y - nearY) * (y - nearY) < radius * radius) return true;
    }
  }
  return false;
}

/**
 * Move a body by (dx, dy), sliding along walls. Returns 0 when free, else a bit mask:
 * 1 blocked on the x axis, 2 blocked on the y axis.
 */
export function moveCircle(city, body, dx, dy, radius) {
  let hit = 0;
  if (dx !== 0) {
    if (circleBlocked(city, body.x + dx, body.y, radius)) hit |= 1;
    else body.x += dx;
  }
  if (dy !== 0) {
    if (circleBlocked(city, body.x, body.y + dy, radius)) hit |= 2;
    else body.y += dy;
  }
  return hit;
}

/** How far along the segment a bullet gets before a building stops it, as a fraction 0..1. */
export function rayToWall(city, x0, y0, x1, y1) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(length / 10));
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    if (solidAt(city, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) === 1) return (step - 1) / steps;
  }
  return 1;
}

export function hasLineOfSight(city, x0, y0, x1, y1) {
  return rayToWall(city, x0, y0, x1, y1) >= 1;
}

/** True where people stroll: pavements, plazas, piers and sand. */
export function isWalkway(tile) {
  return tile === T.SIDEWALK || tile === T.PLAZA || tile === T.PIER || tile === T.SAND;
}

export function isRoadTile(tile) {
  return tile === T.ROAD || tile === T.BRIDGE;
}
