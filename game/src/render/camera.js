// The camera: follows the player with a look-ahead, zooms out with speed, shakes on impacts and
// converts between screen and world positions.
import { clamp, lerp } from '../core/mathUtil.js';

/** World units visible top to bottom at zoom 1, whatever the window size. */
const VIEW_HEIGHT = 720;

export function createCamera() {
  return { x: 0, y: 0, zoom: 1.2, scale: 1, width: 1280, height: 720, shake: 0, shakeX: 0, shakeY: 0, kickX: 0, kickY: 0, time: 0 };
}

export function resizeCamera(camera, width, height) {
  camera.width = width;
  camera.height = height;
  camera.scale = (camera.zoom * height) / VIEW_HEIGHT;
}

/** Jump straight to a point (new game, respawn, screenshots). */
export function snapCamera(camera, x, y, zoom) {
  camera.x = x;
  camera.y = y;
  if (zoom) camera.zoom = zoom;
  camera.scale = (camera.zoom * camera.height) / VIEW_HEIGHT;
}

export function updateCamera(camera, world, dt) {
  const player = world.player;
  const vehicle = player.vehicle;
  let targetX = world.focus.x;
  let targetY = world.focus.y;
  let zoom = 1;
  if (world.mode === 'attract') zoom = 0.95;
  else if (vehicle) {
    const speed = Math.hypot(vehicle.vx, vehicle.vy);
    targetX += clamp(vehicle.vx * 0.38, -170, 170);
    targetY += clamp(vehicle.vy * 0.38, -110, 110);
    zoom = lerp(1.22, 0.9, clamp(speed / 430, 0, 1));
  } else {
    targetX += Math.cos(player.aimAngle) * 46;
    targetY += Math.sin(player.aimAngle) * 46;
    zoom = 1.32;
  }
  const follow = Math.min(1, dt * 4.5);
  camera.x += (targetX - camera.x) * follow;
  camera.y += (targetY - camera.y) * follow;
  camera.zoom += (zoom - camera.zoom) * Math.min(1, dt * 1.6);
  camera.scale = (camera.zoom * camera.height) / VIEW_HEIGHT;
  camera.time += dt;
  camera.shake *= Math.exp(-7 * dt);
  camera.shakeX = Math.sin(camera.time * 91) * camera.shake;
  camera.shakeY = Math.cos(camera.time * 77) * camera.shake;
  camera.kickX *= Math.exp(-12 * dt);
  camera.kickY *= Math.exp(-12 * dt);
}

export function applyCamera(ctx, camera) {
  ctx.setTransform(camera.scale, 0, 0, camera.scale, camera.width / 2 - (camera.x + camera.shakeX + camera.kickX) * camera.scale, camera.height / 2 - (camera.y + camera.shakeY + camera.kickY) * camera.scale);
}

export function screenToWorld(camera, sx, sy) {
  return { x: camera.x + (sx - camera.width / 2) / camera.scale, y: camera.y + (sy - camera.height / 2) / camera.scale };
}

export function worldToScreen(camera, x, y) {
  return { x: (x - camera.x) * camera.scale + camera.width / 2, y: (y - camera.y) * camera.scale + camera.height / 2 };
}

/** The world rectangle in view, grown by `margin` world units on every side. */
export function viewBounds(camera, margin = 0) {
  const halfW = camera.width / 2 / camera.scale + margin;
  const halfH = camera.height / 2 / camera.scale + margin;
  return { x0: camera.x - halfW, y0: camera.y - halfH, x1: camera.x + halfW, y1: camera.y + halfH };
}

export function isOnScreen(camera, x, y, margin = 0) {
  const halfW = camera.width / 2 / camera.scale + margin;
  const halfH = camera.height / 2 / camera.scale + margin;
  return Math.abs(x - camera.x) < halfW && Math.abs(y - camera.y) < halfH;
}
