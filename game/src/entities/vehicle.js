// A vehicle and its arcade physics: throttle, steering, grip and drift, handbrake, rough ground,
// and collisions with buildings and other vehicles.
import { T } from '../core/config.js';
import { approach, clamp } from '../core/mathUtil.js';
import { pick } from '../core/random.js';
import { circleBlocked, tileAt } from '../city/collision.js';
import { VEHICLES } from './vehicleCatalog.js';

let nextVehicleId = 1;

export function createVehicle(kindId, x, y, angle, color) {
  const kind = VEHICLES[kindId];
  return {
    id: nextVehicleId++,
    kind,
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    throttle: 0,
    steer: 0,
    steerShown: 0,
    handbrake: false,
    health: kind.health,
    color: color ?? pick(kind.colors),
    /** null (empty), 'player', or 'ai'. */
    driver: null,
    ai: null,
    police: kind.body === 'police' || kind.body === 'armored',
    siren: false,
    burning: 0,
    wrecked: false,
    wreckAge: 0,
    parked: false,
    skidding: 0,
    hornTime: 0,
    lastImpact: 0,
    tag: null,
    lockedOut: 0,
  };
}

export function forwardSpeed(vehicle) {
  return vehicle.vx * Math.cos(vehicle.angle) + vehicle.vy * Math.sin(vehicle.angle);
}

export function vehicleSpeed(vehicle) {
  return Math.hypot(vehicle.vx, vehicle.vy);
}

function bodyBlocked(city, vehicle, x, y, angle) {
  const reach = vehicle.kind.length * 0.29;
  const radius = vehicle.kind.width * 0.5;
  const cos = Math.cos(angle) * reach;
  const sin = Math.sin(angle) * reach;
  return circleBlocked(city, x + cos, y + sin, radius) || circleBlocked(city, x - cos, y - sin, radius);
}

/**
 * Advance one vehicle by dt. Returns the speed lost in a wall hit this step (0 when none), so
 * the caller can apply damage, sound and camera shake.
 */
export function stepVehicle(city, vehicle, dt) {
  const kind = vehicle.kind;
  if (vehicle.parked && vehicle.vx === 0 && vehicle.vy === 0 && vehicle.throttle === 0) return 0;
  vehicle.parked = false;
  const dead = vehicle.wrecked || vehicle.health <= 0;
  const throttle = dead ? 0 : vehicle.throttle;
  const ground = tileAt(city, vehicle.x, vehicle.y);
  const rough = ground === T.SAND || ground === T.GRASS;
  const topSpeed = kind.speed * (rough ? 0.72 : 1) * (vehicle.health < kind.health * 0.3 ? 0.8 : 1);

  // Steering turns the car in proportion to how fast it rolls.
  let forward = forwardSpeed(vehicle);
  const steerPower = clamp(forward / 130, -1, 1) * (1 - 0.5 * Math.min(1, Math.abs(forward) / kind.speed));
  const newAngle = vehicle.angle + vehicle.steer * 3.1 * steerPower * (vehicle.handbrake ? 1.35 : 1) * dt;
  if (!bodyBlocked(city, vehicle, vehicle.x, vehicle.y, newAngle)) vehicle.angle = newAngle;
  vehicle.steerShown = approach(vehicle.steerShown, vehicle.steer, dt * 6);

  const cos = Math.cos(vehicle.angle);
  const sin = Math.sin(vehicle.angle);
  forward = vehicle.vx * cos + vehicle.vy * sin;
  let lateral = -vehicle.vx * sin + vehicle.vy * cos;

  if (throttle > 0) {
    if (forward < topSpeed) forward += kind.accel * throttle * (forward < 0 ? 2.2 : 1) * dt;
  } else if (throttle < 0) {
    if (forward > 12) forward -= 560 * -throttle * dt;
    else if (forward > -topSpeed * 0.38) forward -= kind.accel * 0.7 * -throttle * dt;
  }
  forward -= forward * (rough ? 0.9 : 0.32) * dt;
  if (throttle === 0) forward = approach(forward, 0, 34 * dt);
  if (vehicle.handbrake) forward = approach(forward, 0, 300 * dt);
  if (forward > topSpeed) forward = approach(forward, topSpeed, 240 * dt);

  const grip = (vehicle.handbrake ? 1.4 : kind.grip) * (rough ? 0.6 : 1);
  lateral *= Math.exp(-grip * dt);
  vehicle.skidding = Math.abs(lateral) > 55 || (vehicle.handbrake && Math.abs(forward) > 60) ? Math.min(1, Math.abs(lateral) / 160 + 0.35) : 0;

  vehicle.vx = cos * forward - sin * lateral;
  vehicle.vy = sin * forward + cos * lateral;
  if (Math.abs(vehicle.vx) + Math.abs(vehicle.vy) < 0.5 && throttle === 0) {
    vehicle.vx = 0;
    vehicle.vy = 0;
  }

  let impact = 0;
  const stepX = vehicle.vx * dt;
  const stepY = vehicle.vy * dt;
  if (stepX !== 0) {
    if (bodyBlocked(city, vehicle, vehicle.x + stepX, vehicle.y, vehicle.angle)) {
      impact += Math.abs(vehicle.vx);
      vehicle.vx *= -0.28;
    } else vehicle.x += stepX;
  }
  if (stepY !== 0) {
    if (bodyBlocked(city, vehicle, vehicle.x, vehicle.y + stepY, vehicle.angle)) {
      impact += Math.abs(vehicle.vy);
      vehicle.vy *= -0.28;
    } else vehicle.y += stepY;
  }
  if (vehicle.hornTime > 0) vehicle.hornTime -= dt;
  if (vehicle.lockedOut > 0) vehicle.lockedOut -= dt;
  return impact;
}

/**
 * Push two overlapping vehicles apart and trade momentum. Returns the closing speed of the hit
 * (0 when they do not touch).
 */
export function collideVehicles(a, b) {
  const reachA = a.kind.length * 0.27;
  const reachB = b.kind.length * 0.27;
  const range = reachA + reachB + (a.kind.width + b.kind.width) * 0.5;
  const dx0 = b.x - a.x;
  const dy0 = b.y - a.y;
  if (dx0 * dx0 + dy0 * dy0 > range * range) return 0;
  const radiusA = a.kind.width * 0.5;
  const radiusB = b.kind.width * 0.5;
  let worst = 0;
  for (const sa of [-1, 1]) {
    const ax = a.x + Math.cos(a.angle) * reachA * sa;
    const ay = a.y + Math.sin(a.angle) * reachA * sa;
    for (const sb of [-1, 1]) {
      const bx = b.x + Math.cos(b.angle) * reachB * sb;
      const by = b.y + Math.sin(b.angle) * reachB * sb;
      const dx = bx - ax;
      const dy = by - ay;
      const gap = Math.hypot(dx, dy);
      const overlap = radiusA + radiusB - gap;
      if (overlap <= 0 || gap === 0) continue;
      const nx = dx / gap;
      const ny = dy / gap;
      const massA = a.kind.health;
      const massB = b.kind.health;
      const shareA = a.parked && a.wrecked ? 0.2 : massB / (massA + massB);
      a.x -= nx * overlap * shareA;
      a.y -= ny * overlap * shareA;
      b.x += nx * overlap * (1 - shareA);
      b.y += ny * overlap * (1 - shareA);
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (closing > 0) {
        const impulse = closing * 1.35;
        a.vx -= nx * impulse * shareA;
        a.vy -= ny * impulse * shareA;
        b.vx += nx * impulse * (1 - shareA);
        b.vy += ny * impulse * (1 - shareA);
        a.parked = false;
        b.parked = false;
        worst = Math.max(worst, closing);
      }
    }
  }
  return worst;
}

/** The point beside the driver's door, where someone getting out stands. */
export function doorPosition(vehicle, side = -1) {
  const offset = vehicle.kind.width * 0.5 + 11;
  return {
    x: vehicle.x - Math.sin(vehicle.angle) * offset * side,
    y: vehicle.y + Math.cos(vehicle.angle) * offset * side,
  };
}
