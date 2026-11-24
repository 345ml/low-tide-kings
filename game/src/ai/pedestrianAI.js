// Pedestrians: they stroll along pavements, plazas, piers and the beach, cross streets now and
// then, stop to idle, and run from gunfire, crashes and brawls.
import { POPULATION, T, TILE } from '../core/config.js';
import { dist } from '../core/mathUtil.js';
import { chance, rand, randRange } from '../core/random.js';
import { isRoadTile, isWalkway, solidAt, tileAt } from '../city/collision.js';
import { isOnScreen } from '../render/camera.js';
import { createPerson } from '../entities/person.js';

const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function walkableAt(city, x, y) {
  return solidAt(city, x, y) === 0 && isWalkway(tileAt(city, x, y));
}

export function spawnPedestrian(world, x, y) {
  const person = createPerson('ped', x, y);
  const heading = Math.floor(rand() * 4);
  person.ai = { type: 'ped', mode: 'walk', heading, tx: x, ty: y, pause: 0, speed: randRange(38, 62), fleeX: 0, fleeY: 0, fleeTime: 0 };
  world.people.push(person);
  return person;
}

/** Keep people on the pavements near the player; drop the ones far behind. */
export function populatePedestrians(world) {
  let count = 0;
  for (const person of world.people) if (person.role === 'ped' && person.alive) count += 1;
  const everywhere = world.clock < 0.2;
  for (let attempt = 0; attempt < (everywhere ? 400 : 6) && count < POPULATION.pedestrians; attempt += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = everywhere ? randRange(60, POPULATION.spawnMax) : randRange(POPULATION.spawnMin - 150, POPULATION.spawnMax - 150);
    const x = (Math.floor((world.focus.x + Math.cos(angle) * radius) / TILE) + 0.5) * TILE;
    const y = (Math.floor((world.focus.y + Math.sin(angle) * radius) / TILE) + 0.5) * TILE;
    if (!walkableAt(world.city, x, y)) continue;
    if (!everywhere && isOnScreen(world.camera, x, y, 30)) continue;
    spawnPedestrian(world, x, y);
    count += 1;
  }
}

function chooseStep(world, person) {
  const ai = person.ai;
  const city = world.city;
  const cx = (Math.floor(person.x / TILE) + 0.5) * TILE;
  const cy = (Math.floor(person.y / TILE) + 0.5) * TILE;
  const order = chance(0.82) ? [0, 1, 3, 2] : chance(0.5) ? [1, 3, 0, 2] : [3, 1, 0, 2];
  for (const turn of order) {
    const heading = (ai.heading + turn) % 4;
    const [dx, dy] = DIRECTIONS[heading];
    const nx = cx + dx * TILE;
    const ny = cy + dy * TILE;
    if (walkableAt(city, nx, ny)) {
      ai.heading = heading;
      ai.tx = nx + randRange(-7, 7);
      ai.ty = ny + randRange(-7, 7);
      return;
    }
    // A street ahead: sometimes cross it, if there is pavement on the far side.
    if (turn !== 2 && isRoadTile(tileAt(city, nx, ny)) && chance(0.3)) {
      for (let reach = 2; reach <= 7; reach += 1) {
        const fx = cx + dx * TILE * reach;
        const fy = cy + dy * TILE * reach;
        if (isRoadTile(tileAt(city, fx, fy))) continue;
        if (walkableAt(city, fx, fy)) {
          ai.heading = heading;
          ai.tx = fx;
          ai.ty = fy;
          return;
        }
        break;
      }
    }
  }
  ai.pause = 1.5;
}

/** One step of a pedestrian's thinking: sets the velocity they try to walk at. */
export function thinkPedestrian(world, person, dt) {
  const ai = person.ai;
  if (ai.mode === 'flee') {
    ai.fleeTime -= dt;
    const away = Math.atan2(person.y - ai.fleeY, person.x - ai.fleeX) + Math.sin(world.clock * 3 + person.id) * 0.5;
    person.moveX = Math.cos(away) * 165;
    person.moveY = Math.sin(away) * 165;
    person.angle = away;
    if (ai.fleeTime <= 0) {
      ai.mode = 'walk';
      ai.tx = person.x;
      ai.ty = person.y;
    }
    return;
  }
  if (ai.pause > 0) {
    ai.pause -= dt;
    person.moveX = 0;
    person.moveY = 0;
    return;
  }
  const gap = dist(person.x, person.y, ai.tx, ai.ty);
  if (gap < 5) {
    if (chance(0.012)) ai.pause = randRange(1.5, 5);
    chooseStep(world, person);
    return;
  }
  const angle = Math.atan2(ai.ty - person.y, ai.tx - person.x);
  person.angle = angle;
  person.moveX = Math.cos(angle) * ai.speed;
  person.moveY = Math.sin(angle) * ai.speed;
  ai.stall = Math.hypot(person.vx, person.vy) < 6 ? (ai.stall ?? 0) + dt : 0;
  if (ai.stall > 1.2) {
    ai.stall = 0;
    ai.heading = (ai.heading + 2) % 4;
    chooseStep(world, person);
  }
}

/** Send every pedestrian within `radius` of a point running away from it. */
export function scarePedestrians(world, x, y, radius) {
  for (const person of world.people) {
    if (person.role !== 'ped' || !person.alive || dist(person.x, person.y, x, y) > radius) continue;
    person.ai.mode = 'flee';
    person.ai.fleeX = x;
    person.ai.fleeY = y;
    person.ai.fleeTime = randRange(5, 9);
  }
}

/** A random pavement spot between two distances of a point (taxi fares, mission pickups). */
export function findPavementNear(world, x, y, minRadius, maxRadius) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = randRange(minRadius, maxRadius);
    const px = (Math.floor((x + Math.cos(angle) * radius) / TILE) + 0.5) * TILE;
    const py = (Math.floor((y + Math.sin(angle) * radius) / TILE) + 0.5) * TILE;
    if (solidAt(world.city, px, py) === 0 && tileAt(world.city, px, py) === T.SIDEWALK) return { x: px, y: py };
  }
  return { x, y };
}
