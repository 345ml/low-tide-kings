// The Marazul Bay Police Department's answer to the wanted level: cruisers and armoured Bulwarks
// that hunt the player along the road network, officers who get out to arrest or shoot, and a
// helicopter with a searchlight from three stars up.
import { WANTED_TUNING } from '../core/config.js';
import { angleDiff, clamp, dist } from '../core/mathUtil.js';
import { pick, rand, randRange } from '../core/random.js';
import { hasLineOfSight } from '../city/collision.js';
import { findRoute, nearestNode } from '../city/roadGraph.js';
import { isOnScreen } from '../render/camera.js';
import { createPerson } from '../entities/person.js';
import { createVehicle, doorPosition, forwardSpeed, vehicleSpeed } from '../entities/vehicle.js';
import { driveToward, holdSpeed } from '../ai/driverControls.js';
import { giveTrafficDriver } from '../ai/trafficAI.js';
import { attackWith } from '../combat/weapons.js';
import { damagePerson, damageVehicle } from '../combat/damage.js';

/** Pursuit vehicles wanted on the streets at each star level. */
const UNITS_BY_STARS = [0, 1, 2, 3, 4, 5];
const HELI_STARS = 3;
const HELI_FIRE_STARS = 5;
const ARMORED_STARS = 4;

export function createPolice() {
  return { spawnTimer: 0, heli: null, bust: 0 };
}

function spawnPursuit(world) {
  const graph = world.city.graph;
  const stars = world.wanted.stars;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const node = pick(graph.nodes);
    const d = dist(node.x, node.y, world.focus.x, world.focus.y);
    if (d < 520 || d > 1150 || isOnScreen(world.camera, node.x, node.y, 100)) continue;
    const armored = stars >= ARMORED_STARS && rand() < 0.4;
    const angle = Math.atan2(world.focus.y - node.y, world.focus.x - node.x);
    const vehicle = createVehicle(armored ? 'bulwark' : 'cruiser', node.x, node.y, angle);
    makePursuer(vehicle);
    world.vehicles.push(vehicle);
    return;
  }
}

export function makePursuer(vehicle) {
  vehicle.driver = 'ai';
  vehicle.siren = true;
  vehicle.ai = { type: 'pursuit', route: [], routeTimer: 0, stuck: 0, reverse: 0, reverseSteer: 0, crew: vehicle.kind.body === 'armored' ? 3 : 2 };
}

export function spawnOfficer(world, x, y, heavy) {
  const cop = createPerson('cop', x, y);
  cop.weapon = heavy ? 'smg' : 'pistol';
  if (heavy) {
    cop.health = 170;
    cop.look.shirt = '#20252e';
    cop.look.hat = '#11151b';
  }
  cop.ai = { type: 'cop', aim: randRange(0.06, 0.12), burst: 0, pause: randRange(0.4, 1.2), leaving: false };
  world.people.push(cop);
  return cop;
}

function dismount(world, vehicle) {
  const heavy = vehicle.kind.body === 'armored';
  for (let n = 0; n < vehicle.ai.crew; n += 1) {
    const door = doorPosition(vehicle, n % 2 === 0 ? -1 : 1);
    spawnOfficer(world, door.x + n * 3, door.y + n * 3, heavy);
  }
  vehicle.ai = null;
  vehicle.driver = null;
  vehicle.throttle = 0;
  vehicle.steer = 0;
  vehicle.handbrake = true;
  vehicle.emptiedAt = world.clock;
}

/** One step of a pursuit driver: close on the player by road, then ram, block or dismount. */
export function drivePursuit(world, vehicle, dt) {
  const ai = vehicle.ai;
  const player = world.player;
  const target = world.wanted.seen || world.wanted.hidden < 2 ? world.focus : { x: world.wanted.lastX, y: world.wanted.lastY };
  const d = dist(vehicle.x, vehicle.y, target.x, target.y);
  const forward = forwardSpeed(vehicle);
  if (ai.reverse > 0) {
    ai.reverse -= dt;
    vehicle.throttle = -1;
    vehicle.steer = ai.reverseSteer;
    vehicle.handbrake = false;
    return;
  }
  const playerSpeed = player.vehicle ? vehicleSpeed(player.vehicle) : 0;
  const slowTarget = !player.vehicle || playerSpeed < 45;
  if (world.wanted.seen && slowTarget && d < 170 && Math.abs(forward) < 90) {
    dismount(world, vehicle);
    return;
  }
  const direct = d < 380 || (d < 760 && hasLineOfSight(world.city, vehicle.x, vehicle.y, target.x, target.y));
  let turn;
  if (direct) {
    const lead = player.vehicle ? 0.35 : 0;
    const speed = slowTarget && d < 260 ? 110 : vehicle.kind.speed;
    turn = driveToward(vehicle, target.x + (player.vehicle ? player.vehicle.vx * lead : 0), target.y + (player.vehicle ? player.vehicle.vy * lead : 0), speed);
  } else {
    ai.routeTimer -= dt;
    if (ai.routeTimer <= 0 || ai.route.length === 0) {
      ai.routeTimer = 1;
      const graph = world.city.graph;
      ai.route = findRoute(graph, nearestNode(graph, vehicle.x, vehicle.y).id, nearestNode(graph, target.x, target.y).id);
    }
    const nodes = world.city.graph.nodes;
    let goal = nodes[ai.route[0]];
    if (ai.route.length > 1 && dist(vehicle.x, vehicle.y, goal.x, goal.y) < 120) goal = nodes[ai.route[1]];
    const gap = dist(vehicle.x, vehicle.y, goal.x, goal.y);
    turn = driveToward(vehicle, goal.x, goal.y, gap < 170 && ai.route.length > 1 ? 190 : vehicle.kind.speed * 0.85);
  }
  if (Math.abs(forward) < 22 && vehicle.throttle > 0) ai.stuck += dt;
  else ai.stuck = Math.max(0, ai.stuck - dt);
  if (ai.stuck > 1.1) {
    ai.stuck = 0;
    ai.reverse = 0.9;
    ai.reverseSteer = turn > 0 ? -1 : 1;
  }
}

function tryBust(world, cop, d, dt) {
  const player = world.player;
  const slow = player.vehicle ? vehicleSpeed(player.vehicle) < 28 : true;
  if (d < (player.vehicle ? 42 : 26) && slow && world.wanted.stars <= 2) {
    world.police.bust += dt * 2;
    if (world.police.bust > 1.6 && !world.respawn) {
      world.respawn = { kind: 'busted', timer: 4 };
      world.audio.play('busted');
    }
  }
}

/** One step of an officer on foot: chase, arrest at low stars, open fire at higher ones. */
export function thinkOfficer(world, cop, dt) {
  const ai = cop.ai;
  const stars = world.wanted.stars;
  const tx = world.focus.x;
  const ty = world.focus.y;
  const d = dist(cop.x, cop.y, tx, ty);
  const angle = Math.atan2(ty - cop.y, tx - cop.x);
  if (stars === 0 || world.respawn) {
    ai.leaving = true;
    cop.moveX = Math.cos(angle + Math.PI) * 50;
    cop.moveY = Math.sin(angle + Math.PI) * 50;
    cop.angle = angle + Math.PI;
    return;
  }
  ai.leaving = false;
  cop.angle = angle;
  const sight = d < WANTED_TUNING.sightRange && hasLineOfSight(world.city, cop.x, cop.y, tx, ty);
  const shooting = stars >= 2 || (ai.provoked ?? false);
  const hold = shooting && sight ? 150 : 14;
  const speed = d > hold ? 150 : d < hold - 60 ? -60 : 0;
  const weave = Math.sin(world.clock * 1.7 + cop.id) * 0.5;
  cop.moveX = Math.cos(angle + weave) * speed;
  cop.moveY = Math.sin(angle + weave) * speed;
  tryBust(world, cop, d, dt);
  if (!shooting || !sight || d > 420) return;
  ai.pause -= dt;
  if (ai.pause > 0) return;
  attackWith(world, cop, cop.weapon, angle + (rand() - 0.5) * 2 * ai.aim, null);
  ai.burst += 1;
  if (ai.burst >= (cop.weapon === 'smg' ? 6 : 2)) {
    ai.burst = 0;
    ai.pause = randRange(0.7, 1.5);
  }
}

function stepHeli(world, dt) {
  const police = world.police;
  const stars = world.wanted.stars;
  if (!police.heli && stars >= HELI_STARS && world.mode !== 'attract') {
    const angle = rand() * Math.PI * 2;
    const x = world.focus.x + Math.cos(angle) * 950;
    const y = world.focus.y + Math.sin(angle) * 950;
    police.heli = { x, y, vx: 0, vy: 0, angle: 0, rotor: 0, lightX: x, lightY: y, fire: 2, leaving: false, orbit: rand() * 6 };
  }
  const heli = police.heli;
  if (!heli) return;
  heli.rotor += dt * 34;
  heli.leaving = stars < HELI_STARS;
  heli.orbit += dt * 0.5;
  const known = world.wanted.seen || world.wanted.hidden < 3;
  const goalX = heli.leaving ? heli.x + (heli.x - world.focus.x) : (known ? world.focus.x : world.wanted.lastX) + Math.cos(heli.orbit) * 130;
  const goalY = heli.leaving ? heli.y + (heli.y - world.focus.y) : (known ? world.focus.y : world.wanted.lastY) + Math.sin(heli.orbit) * 130;
  const d = dist(heli.x, heli.y, goalX, goalY) || 1;
  const want = Math.min(330, d * 1.6);
  heli.vx += (((goalX - heli.x) / d) * want - heli.vx) * Math.min(1, dt * 1.6);
  heli.vy += (((goalY - heli.y) / d) * want - heli.vy) * Math.min(1, dt * 1.6);
  heli.x += heli.vx * dt;
  heli.y += heli.vy * dt;
  const face = Math.atan2(world.focus.y - heli.y, world.focus.x - heli.x);
  heli.angle += clamp(angleDiff(heli.angle, face), -dt * 2, dt * 2);
  const lightGoalX = known ? world.focus.x : world.wanted.lastX + Math.cos(world.clock * 0.9) * 170;
  const lightGoalY = known ? world.focus.y : world.wanted.lastY + Math.sin(world.clock * 1.3) * 170;
  heli.lightX += (lightGoalX - heli.lightX) * Math.min(1, dt * 2.2);
  heli.lightY += (lightGoalY - heli.lightY) * Math.min(1, dt * 2.2);
  if (heli.leaving && dist(heli.x, heli.y, world.focus.x, world.focus.y) > 1500) {
    police.heli = null;
    return;
  }
  if (stars >= HELI_FIRE_STARS && world.wanted.seen && !world.respawn && dist(heli.x, heli.y, world.focus.x, world.focus.y) < 420) {
    heli.fire -= dt;
    if (heli.fire <= 0) {
      heli.fire = heli.burst > 4 ? 2.4 : 0.11;
      heli.burst = heli.burst > 4 ? 0 : (heli.burst ?? 0) + 1;
      const hx = world.focus.x + randRange(-42, 42);
      const hy = world.focus.y + randRange(-42, 42);
      world.fx.tracer(heli.x, heli.y, hx, hy);
      world.fx.sparks(hx, hy, 3);
      world.audio.play('rifle', heli.x, heli.y);
      const near = dist(hx, hy, world.focus.x, world.focus.y);
      if (world.player.vehicle && near < 30) damageVehicle(world, world.player.vehicle, 9, null);
      else if (!world.player.vehicle && near < 15) damagePerson(world, world.player, 9, null, face);
    }
  }
}

/** Dispatch: keep the right number of units on the player for the wanted level, stand down at zero. */
export function stepPolice(world, dt) {
  const police = world.police;
  const stars = world.wanted.stars;
  police.bust = Math.max(0, police.bust - dt);
  let units = 0;
  for (const vehicle of world.vehicles) {
    if (!vehicle.police || vehicle.wrecked) continue;
    const ai = vehicle.ai;
    if (ai && ai.type === 'pursuit') {
      if (stars === 0) {
        const graph = world.city.graph;
        const node = nearestNode(graph, vehicle.x, vehicle.y);
        giveTrafficDriver(world, vehicle, node.id, pick(node.links).node);
        vehicle.siren = false;
      } else units += 1;
    } else if (ai && ai.type === 'traffic' && stars > 0 && dist(vehicle.x, vehicle.y, world.focus.x, world.focus.y) < 650) {
      makePursuer(vehicle);
      units += 1;
    } else if (!ai && vehicle.driver === null && stars === 0) vehicle.siren = false;
  }
  for (const person of world.people) if (person.role === 'cop' && person.alive && !person.ai.leaving) units += 0.5;
  if (stars > 0 && world.mode !== 'attract') {
    police.spawnTimer -= dt;
    if (units < UNITS_BY_STARS[stars] + 0.5 && police.spawnTimer <= 0) {
      police.spawnTimer = 3.2 - stars * 0.4;
      spawnPursuit(world);
    }
  }
  stepHeli(world, dt);
}
