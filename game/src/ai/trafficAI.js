// Civilian traffic: drivers keep to their lane, obey signals, brake for whatever is ahead, pick
// a turn at each intersection and panic when shot at. Also fills the streets near the player
// and the city's parking spots.
import { POPULATION, STOP_BACK } from '../core/config.js';
import { dist } from '../core/mathUtil.js';
import { pick, rand } from '../core/random.js';
import { SIGNAL_GREEN, lanePoint, randomLaneSpot, signalState, travelDirection } from '../city/roadGraph.js';
import { isOnScreen } from '../render/camera.js';
import { createVehicle, forwardSpeed } from '../entities/vehicle.js';
import { PARKED_MIX, TRAFFIC_MIX } from '../entities/vehicleCatalog.js';
import { driveToward, holdSpeed, senseAhead } from './driverControls.js';

/** Put a computer driver in a vehicle, travelling the street from node `from` to node `to`. */
export function giveTrafficDriver(world, vehicle, from, to) {
  const d = travelDirection(world.city.graph, from, to);
  const stop = lanePoint(world.city.graph, from, to, d.length - STOP_BACK);
  vehicle.driver = 'ai';
  vehicle.ai = { type: 'traffic', from, to, phase: 'edge', tx: stop.x, ty: stop.y, cruise: 150 + rand() * 60, blocked: 0, push: 0, panic: 0, next: -1, reckless: false };
}

export function spawnTrafficVehicle(world, spot, kindId) {
  const vehicle = createVehicle(kindId ?? pick(TRAFFIC_MIX), spot.x, spot.y, spot.angle);
  giveTrafficDriver(world, vehicle, spot.from, spot.to);
  vehicle.vx = Math.cos(spot.angle) * 120;
  vehicle.vy = Math.sin(spot.angle) * 120;
  world.vehicles.push(vehicle);
  return vehicle;
}

/** Keep the streets around the player busy: add cars just out of view, drop the ones left far behind. */
export function populateTraffic(world) {
  let count = 0;
  for (const vehicle of world.vehicles) if (vehicle.ai && vehicle.ai.type === 'traffic') count += 1;
  const everywhere = world.clock < 0.2;
  for (let attempt = 0; attempt < (everywhere ? 220 : 3) && count < POPULATION.traffic; attempt += 1) {
    const spot = randomLaneSpot(world.city.graph, rand);
    const distance = dist(spot.x, spot.y, world.focus.x, world.focus.y);
    if (distance > POPULATION.spawnMax) continue;
    if (!everywhere && (distance < POPULATION.spawnMin || isOnScreen(world.camera, spot.x, spot.y, 80))) continue;
    if (everywhere && distance < 130) continue;
    let crowded = false;
    for (const other of world.vehicles) if (dist(other.x, other.y, spot.x, spot.y) < 110) crowded = true;
    if (crowded) continue;
    spawnTrafficVehicle(world, spot);
    count += 1;
  }
}

/** Park a car in each filled parking spot of the city (done once, when a world is made). */
export function fillParkingSpots(world) {
  for (const spot of world.city.parking) {
    if (!spot.fill) continue;
    const vehicle = createVehicle(pick(PARKED_MIX), spot.x, spot.y, spot.angle);
    vehicle.parked = true;
    vehicle.home = true;
    world.vehicles.push(vehicle);
  }
}

function chooseNext(world, ai) {
  const links = world.city.graph.nodes[ai.to].links;
  const options = links.filter((link) => link.node !== ai.from);
  return options.length ? pick(options).node : ai.from;
}

/** One step of a traffic driver's thinking: sets the vehicle's steering, throttle and brake. */
export function driveTraffic(world, vehicle, dt) {
  const ai = vehicle.ai;
  const graph = world.city.graph;
  const forward = forwardSpeed(vehicle);
  const gap = dist(vehicle.x, vehicle.y, ai.tx, ai.ty);
  if (ai.panic > 0) ai.panic -= dt;
  if (ai.push > 0) ai.push -= dt;
  let speed = ai.phase === 'turn' ? 95 : ai.cruise;
  if (ai.panic > 0) speed *= 1.7;

  if (ai.phase === 'edge') {
    if (ai.next < 0) ai.next = chooseNext(world, ai);
    const node = graph.nodes[ai.to];
    const horizontal = graph.nodes[ai.from].y === node.y;
    const mustStop = ai.panic <= 0 && signalState(node, world.clock, horizontal) !== SIGNAL_GREEN;
    if (mustStop) speed = Math.min(speed, Math.max(0, (gap - 14) * 1.6));
    else if (gap < 120) speed = Math.min(speed, 110);
    if (gap < 26 && !mustStop) {
      const entry = lanePoint(graph, ai.to, ai.next, STOP_BACK);
      ai.from = ai.to;
      ai.to = ai.next;
      ai.next = -1;
      ai.phase = 'turn';
      ai.tx = entry.x;
      ai.ty = entry.y;
    }
  } else if (gap < 30) {
    const d = travelDirection(graph, ai.from, ai.to);
    const stop = lanePoint(graph, ai.from, ai.to, d.length - STOP_BACK);
    ai.phase = 'edge';
    ai.tx = stop.x;
    ai.ty = stop.y;
  }

  const reach = 26 + Math.max(0, forward) * 0.55;
  const obstacle = ai.reckless ? 0 : senseAhead(world, vehicle, reach, ai.push > 0);
  if (obstacle && !(ai.panic > 0 && obstacle === 1)) {
    speed = 0;
    ai.blocked += dt;
    if (ai.blocked > 3.5 && obstacle === 2) {
      ai.push = 1.6;
      ai.blocked = 0;
      if (rand() < 0.5) vehicle.hornTime = 0.5;
    }
  } else ai.blocked = Math.max(0, ai.blocked - dt * 2);

  if (speed <= 0) {
    holdSpeed(vehicle, 0);
    vehicle.steer = 0;
  } else driveToward(vehicle, ai.tx, ai.ty, ai.push > 0 ? Math.min(speed, 60) : speed);
}

/** Frighten every traffic driver near a point (gunfire, an explosion): they floor it. */
export function panicDrivers(world, x, y, radius) {
  for (const vehicle of world.vehicles) {
    if (vehicle.ai && vehicle.ai.type === 'traffic' && dist(vehicle.x, vehicle.y, x, y) < radius) vehicle.ai.panic = 6;
  }
}
