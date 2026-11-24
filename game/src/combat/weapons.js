// The weapons of Marazul Bay and how they are used: punches, and guns that fire instant shots
// stopped by walls, people and vehicles.
import { segmentCircle } from '../core/mathUtil.js';
import { rand } from '../core/random.js';
import { rayToWall } from '../city/collision.js';
import { panicDrivers } from '../ai/trafficAI.js';
import { scarePedestrians } from '../ai/pedestrianAI.js';
import { reportCrime } from '../police/wantedSystem.js';
import { damagePerson, damageVehicle } from './damage.js';

export const WEAPONS = {
  fists: { id: 'fists', name: 'Fists', melee: true, damage: 17, rate: 0.36, range: 30 },
  pistol: { id: 'pistol', name: 'Tidewater 9', damage: 24, rate: 0.26, range: 560, spread: 0.03, pellets: 1, auto: false, price: 350, pack: 60, sound: 'pistol' },
  smg: { id: 'smg', name: 'Mako SMG', damage: 13, rate: 0.085, range: 520, spread: 0.085, pellets: 1, auto: true, price: 1200, pack: 150, sound: 'smg' },
  shotgun: { id: 'shotgun', name: 'Breaker 12', damage: 13, rate: 0.72, range: 300, spread: 0.24, pellets: 7, auto: false, price: 1800, pack: 24, sound: 'shotgun' },
  rifle: { id: 'rifle', name: 'Longfin AR', damage: 28, rate: 0.115, range: 720, spread: 0.04, pellets: 1, auto: true, price: 3600, pack: 120, sound: 'rifle' },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

function sameSide(shooter, target) {
  return shooter.role === target.role && shooter.role !== 'player' && shooter.role !== 'ped';
}

/** Fire one instant shot from (x, y) along `angle`; returns what it hit. */
export function castShot(world, shooter, x, y, angle, range, damage) {
  const ex = x + Math.cos(angle) * range;
  const ey = y + Math.sin(angle) * range;
  let best = rayToWall(world.city, x, y, ex, ey);
  let hitPerson = null;
  let hitVehicle = null;
  for (const person of world.people) {
    if (!person.alive || person === shooter || person.vehicle || sameSide(shooter, person)) continue;
    const t = segmentCircle(x, y, ex, ey, person.x, person.y, person.radius + 3);
    if (t >= 0 && t < best) {
      best = t;
      hitPerson = person;
      hitVehicle = null;
    }
  }
  for (const vehicle of world.vehicles) {
    if (vehicle === shooter.vehicle) continue;
    const t = segmentCircle(x, y, ex, ey, vehicle.x, vehicle.y, vehicle.kind.width * 0.62 + vehicle.kind.length * 0.12);
    if (t >= 0 && t < best) {
      best = t;
      hitVehicle = vehicle;
      hitPerson = null;
    }
  }
  const hx = x + (ex - x) * best;
  const hy = y + (ey - y) * best;
  world.fx.tracer(x, y, hx, hy);
  if (hitPerson) damagePerson(world, hitPerson, damage, shooter, angle);
  else if (hitVehicle) {
    world.fx.sparks(hx, hy, 4);
    damageVehicle(world, hitVehicle, damage * 0.55, shooter);
    if (hitVehicle.driver === 'player' && shooter !== world.player) damagePerson(world, world.player, damage * 0.22, shooter, angle);
  } else if (best < 1) world.fx.sparks(hx, hy, 3);
  return { x: hx, y: hy, person: hitPerson, vehicle: hitVehicle };
}

function punch(world, person, weapon, angle) {
  person.punch = 0.22;
  world.audio.play('swing', person.x, person.y);
  for (const other of world.people) {
    if (other === person || !other.alive || other.vehicle || sameSide(person, other)) continue;
    const dx = other.x - person.x;
    const dy = other.y - person.y;
    const reach = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (reach < -4 || reach > weapon.range || Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) > 16) continue;
    damagePerson(world, other, weapon.damage, person, angle);
    world.audio.play('punch', other.x, other.y);
    return;
  }
  for (const vehicle of world.vehicles) {
    const dx = vehicle.x - person.x;
    const dy = vehicle.y - person.y;
    if (dx * dx + dy * dy < 34 * 34 && dx * Math.cos(angle) + dy * Math.sin(angle) > 0) {
      damageVehicle(world, vehicle, 3, person);
      world.audio.play('punch', vehicle.x, vehicle.y);
      return;
    }
  }
}

/**
 * `person` attacks along `angle` with the named weapon, if its cooldown allows. `ammo` is the
 * shooter's ammo table ({ pistol: n, … }) or null for unlimited. Returns true when it fired.
 */
export function attackWith(world, person, weaponId, angle, ammo) {
  if (person.cooldown > 0) return false;
  const weapon = WEAPONS[weaponId];
  person.cooldown = weapon.rate;
  if (weapon.melee) {
    punch(world, person, weapon, angle);
    return true;
  }
  if (ammo) {
    if ((ammo[weaponId] ?? 0) <= 0) {
      world.audio.play('click', person.x, person.y);
      person.cooldown = 0.3;
      return false;
    }
    ammo[weaponId] -= 1;
  }
  const origin = person.vehicle ?? person;
  const reach = person.vehicle ? 0 : 13;
  const x = origin.x + Math.cos(angle) * reach;
  const y = origin.y + Math.sin(angle) * reach;
  for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
    castShot(world, person, x, y, angle + (rand() - 0.5) * 2 * weapon.spread, weapon.range, weapon.damage);
  }
  person.muzzle = 0.06;
  world.fx.muzzle(x + Math.cos(angle) * 8, y + Math.sin(angle) * 8, angle);
  world.audio.play(weapon.sound, x, y);
  if (person === world.player) {
    reportCrime(world, 'gunfire', x, y);
    world.kick(angle, weapon.pellets > 1 ? 5 : 2);
  }
  scarePedestrians(world, x, y, 340);
  panicDrivers(world, x, y, 240);
  return true;
}
