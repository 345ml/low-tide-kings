// The low-level driving skills every computer driver shares: aiming the wheel at a point,
// holding a speed, and sensing what is in the way ahead.
import { angleDiff, clamp } from '../core/mathUtil.js';
import { forwardSpeed } from '../entities/vehicle.js';

/** Set steering and throttle so the vehicle heads for (tx, ty) at about `speed` units a second. */
export function driveToward(vehicle, tx, ty, speed) {
  const wanted = Math.atan2(ty - vehicle.y, tx - vehicle.x);
  const turn = angleDiff(vehicle.angle, wanted);
  const forward = forwardSpeed(vehicle);
  vehicle.steer = clamp(turn * 2.4, -1, 1) * (forward < -5 ? -1 : 1);
  holdSpeed(vehicle, speed * (Math.abs(turn) > 1.1 ? 0.45 : 1));
  return turn;
}

/** Throttle or brake toward a forward speed; 0 brings the vehicle to a firm stop. */
export function holdSpeed(vehicle, speed) {
  const forward = forwardSpeed(vehicle);
  vehicle.handbrake = false;
  if (speed <= 0) {
    vehicle.throttle = forward > 14 ? -1 : 0;
    vehicle.handbrake = forward <= 40;
  } else if (forward < speed - 6) vehicle.throttle = forward < speed * 0.6 ? 1 : 0.6;
  else if (forward > speed + 40) vehicle.throttle = -0.8;
  else vehicle.throttle = 0;
}

/**
 * What blocks the lane within `reach` units ahead: 2 for a vehicle, 1 for a person, 0 for nothing.
 * `ignoreVehicles` lets a driver that has waited too long nose past a jam.
 */
export function senseAhead(world, vehicle, reach, ignoreVehicles) {
  const cos = Math.cos(vehicle.angle);
  const sin = Math.sin(vehicle.angle);
  const nose = vehicle.kind.length * 0.5;
  for (const person of world.people) {
    if (!person.alive || person.vehicle) continue;
    const dx = person.x - vehicle.x;
    const dy = person.y - vehicle.y;
    const along = dx * cos + dy * sin - nose;
    if (along < -4 || along > reach) continue;
    if (Math.abs(-dx * sin + dy * cos) < vehicle.kind.width * 0.5 + 9) return 1;
  }
  if (ignoreVehicles) return 0;
  for (const other of world.vehicles) {
    if (other === vehicle) continue;
    const dx = other.x - vehicle.x;
    const dy = other.y - vehicle.y;
    const along = dx * cos + dy * sin - nose - other.kind.length * 0.45;
    if (along < -20 || along > reach) continue;
    if (Math.abs(-dx * sin + dy * cos) < (vehicle.kind.width + other.kind.width) * 0.5 + 3) return 2;
  }
  return 0;
}
