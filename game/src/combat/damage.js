// Everything that gets hurt: wounding and killing people, damaging and wrecking vehicles, and
// explosions. Each reports the player's crimes and leaves events for the missions to read.
import { dist } from '../core/mathUtil.js';
import { rand } from '../core/random.js';
import { panicDrivers } from '../ai/trafficAI.js';
import { scarePedestrians } from '../ai/pedestrianAI.js';
import { reportCrime } from '../police/wantedSystem.js';
import { dropPickup } from '../world/pickups.js';

export function damagePerson(world, person, amount, attacker, angle = 0) {
  if (!person.alive || amount <= 0) return;
  if (person === world.player) {
    if (world.respawn || world.mode !== 'play') return;
    const absorbed = Math.min(person.armor, amount * 0.75);
    person.armor -= absorbed;
    amount -= absorbed;
    world.hurtFlash = 0.35;
  }
  person.health -= amount;
  person.knockX += Math.cos(angle) * amount * 3;
  person.knockY += Math.sin(angle) * amount * 3;
  world.fx.blood(person.x, person.y, angle);
  if (attacker === world.player && person !== world.player) {
    if (person.role === 'cop') reportCrime(world, 'copAssault', person.x, person.y);
    else if (person.role === 'ped') reportCrime(world, 'assault', person.x, person.y);
  }
  if (person.role === 'ped' && person.ai) {
    person.ai.mode = 'flee';
    person.ai.fleeX = attacker ? attacker.x : person.x - Math.cos(angle) * 20;
    person.ai.fleeY = attacker ? attacker.y : person.y - Math.sin(angle) * 20;
    person.ai.fleeTime = 8;
  }
  if (person.role === 'gang' && person.ai) person.ai.alert = true;
  if (person.health <= 0) killPerson(world, person, attacker);
  else if (person !== world.player) world.audio.play('grunt', person.x, person.y);
}

export function killPerson(world, person, attacker) {
  if (!person.alive) return;
  person.alive = false;
  person.health = 0;
  person.deadAge = 0;
  person.moveX = 0;
  person.moveY = 0;
  world.fx.decal(person.x, person.y, 'blood');
  world.events.push({ type: 'kill', person, attacker });
  if (person === world.player) {
    world.respawn = { kind: 'wasted', timer: 4 };
    world.audio.play('wasted');
    return;
  }
  if (person.cash > 0) dropPickup(world, 'cash', person.x + rand() * 10 - 5, person.y + rand() * 10 - 5, person.cash);
  if (person.role === 'cop' && rand() < 0.5) dropPickup(world, 'ammo', person.x, person.y, 24);
  if (attacker === world.player) {
    world.stats.kills += 1;
    reportCrime(world, person.role === 'cop' ? 'copKill' : person.role === 'ped' ? 'murder' : 'gunfire', person.x, person.y);
  }
  scarePedestrians(world, person.x, person.y, 260);
}

export function damageVehicle(world, vehicle, amount, attacker) {
  if (vehicle.wrecked || amount <= 0) return;
  vehicle.health -= amount;
  vehicle.parked = false;
  if (attacker) vehicle.lastAttacker = attacker;
  if (attacker === world.player && vehicle.police && vehicle.driver !== 'player') reportCrime(world, 'copCarHit', vehicle.x, vehicle.y);
  if (vehicle.ai && vehicle.ai.type === 'traffic') vehicle.ai.panic = 7;
  if (vehicle.health <= 0 && vehicle.burning <= 0) {
    vehicle.health = 0;
    vehicle.burning = 3.2;
    world.events.push({ type: 'disabled', vehicle, attacker });
  }
}

/** Blow a vehicle up: it becomes a burnt wreck and whoever is inside is thrown out. */
export function wreckVehicle(world, vehicle, attacker) {
  if (vehicle.wrecked) return;
  vehicle.wrecked = true;
  vehicle.burning = 0;
  vehicle.wreckAge = 0;
  vehicle.siren = false;
  vehicle.throttle = 0;
  vehicle.ai = null;
  const wasPlayer = vehicle.driver === 'player';
  vehicle.driver = null;
  world.events.push({ type: 'wreck', vehicle, attacker });
  if (wasPlayer) {
    world.player.vehicle = null;
    world.player.x = vehicle.x;
    world.player.y = vehicle.y;
    damagePerson(world, world.player, 400, null, rand() * 6.28);
  }
  explode(world, vehicle.x, vehicle.y, 120, attacker);
}

export function explode(world, x, y, radius, attacker) {
  world.fx.explosion(x, y, radius);
  world.fx.decal(x, y, 'scorch');
  world.audio.play('explosion', x, y);
  world.shake(Math.max(0, 16 - dist(x, y, world.focus.x, world.focus.y) / 40));
  if (attacker === world.player) reportCrime(world, 'explosion', x, y);
  for (const person of world.people) {
    if (!person.alive || person.vehicle) continue;
    const d = dist(person.x, person.y, x, y);
    if (d < radius) damagePerson(world, person, 150 * (1 - d / radius), attacker, Math.atan2(person.y - y, person.x - x));
  }
  for (const vehicle of world.vehicles) {
    if (vehicle.wrecked) continue;
    const d = dist(vehicle.x, vehicle.y, x, y);
    if (d >= radius || d < 1) continue;
    const force = 1 - d / radius;
    vehicle.vx += ((vehicle.x - x) / d) * force * 260;
    vehicle.vy += ((vehicle.y - y) / d) * force * 260;
    damageVehicle(world, vehicle, 170 * force, attacker);
  }
  scarePedestrians(world, x, y, 480);
  panicDrivers(world, x, y, 420);
}
