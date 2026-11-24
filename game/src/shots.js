// The screenshot scenes behind ?shot=start|drive|chase|shootout. Each one sets up a real world,
// then plays the real rules forward for a few seconds with a simple autopilot standing in for
// the keyboard and mouse, so the frame is what the game really looks like at that moment and
// the same seed always gives the same frame.
import { STEP } from './core/config.js';
import { createIdleInput } from './core/input.js';
import { dist } from './core/mathUtil.js';
import { seedRandom } from './core/random.js';
import { nearestNode } from './city/roadGraph.js';
import { resizeCamera, snapCamera, worldToScreen } from './render/camera.js';
import { createSilentAudio } from './audio/soundEffects.js';
import { createVehicle } from './entities/vehicle.js';
import { giveWeapon } from './entities/player.js';
import { giveTrafficDriver } from './ai/trafficAI.js';
import { explode } from './combat/damage.js';
import { clearWanted, raiseWanted } from './police/wantedSystem.js';
import { makePursuer, spawnOfficer } from './police/policeForce.js';
import { startMission } from './missions/missionRunner.js';
import { createWorld, stepWorld } from './world/gameWorld.js';

function run(world, input, seconds, each) {
  const steps = Math.round(seconds / STEP);
  for (let step = 0; step < steps; step += 1) {
    if (each) each(step * STEP);
    world.dialogue = null;
    stepWorld(world, input, STEP);
  }
}

/** Put the player at the wheel of a new car on the street nearest a place, driven by the autopilot. */
function autopilotCar(world, kindId, color, place, towardIndex) {
  const graph = world.city.graph;
  const node = nearestNode(graph, place.x, place.y);
  const link = node.links[towardIndex % node.links.length];
  const vehicle = createVehicle(kindId, node.x, node.y, 0, color);
  giveTrafficDriver(world, vehicle, node.id, link.node);
  const other = graph.nodes[link.node];
  vehicle.angle = Math.atan2(other.y - node.y, other.x - node.x);
  vehicle.x = node.x + Math.cos(vehicle.angle) * 110 - Math.sin(vehicle.angle) * 32;
  vehicle.y = node.y + Math.sin(vehicle.angle) * 110 + Math.cos(vehicle.angle) * 32;
  vehicle.driver = 'player';
  world.vehicles.push(vehicle);
  world.player.vehicle = vehicle;
  world.player.x = vehicle.x;
  world.player.y = vehicle.y;
  world.focus.x = vehicle.x;
  world.focus.y = vehicle.y;
  snapCamera(world.camera, vehicle.x, vehicle.y, 1);
  return vehicle;
}

function clearAround(world, x, y, radius) {
  world.vehicles = world.vehicles.filter((vehicle) => vehicle.driver === 'player' || dist(vehicle.x, vehicle.y, x, y) > radius);
}

function stageDrive(world) {
  world.dayTime = 10.6;
  world.money = 2350;
  startMission(world, 0);
  world.dialogue = null;
  giveWeapon(world, 'pistol', 60);
  const vehicle = autopilotCar(world, 'cabana', '#ff5fa2', world.city.places.plaza, 1);
  clearAround(world, vehicle.x, vehicle.y, 120);
  run(world, createIdleInput(), 5.2, () => {
    vehicle.ai.cruise = 200;
    clearWanted(world);
  });
  world.banner = null;
}

/** Put a police vehicle on the player's tail, as the dispatcher would a few seconds into a chase. */
function pursuerBehind(world, target, kindId, back, side) {
  const cos = Math.cos(target.angle);
  const sin = Math.sin(target.angle);
  const vehicle = createVehicle(kindId, target.x - cos * back - sin * side, target.y - sin * back + cos * side, target.angle);
  vehicle.vx = target.vx * 0.9;
  vehicle.vy = target.vy * 0.9;
  world.vehicles.push(vehicle);
  makePursuer(vehicle);
  return vehicle;
}

function stageChase(world) {
  world.dayTime = 17.75;
  world.money = 8420;
  world.progress = 2;
  giveWeapon(world, 'pistol', 48);
  giveWeapon(world, 'smg', 120);
  startMission(world, 2);
  world.dialogue = null;
  const vehicle = autopilotCar(world, 'marlin', '#ffc94a', world.city.places.beachNorth, 0);
  clearAround(world, vehicle.x, vehicle.y, 160);
  world.mission.vehicle = vehicle;
  vehicle.tag = 'mission';
  world.mission.stepIndex = 2;
  raiseWanted(world, 3);
  const input = createIdleInput();
  const hold = () => {
    vehicle.ai.panic = 5;
    vehicle.ai.reckless = true;
    vehicle.ai.cruise = 190;
    vehicle.health = vehicle.kind.health * 0.8;
    world.player.health = 82;
    world.player.armor = 55;
    world.police.bust = 0;
    if (world.wanted.stars < 3) raiseWanted(world, 3);
  };
  run(world, input, 6.5, hold);
  clearAround(world, vehicle.x - Math.cos(vehicle.angle) * 150, vehicle.y - Math.sin(vehicle.angle) * 150, 130);
  pursuerBehind(world, vehicle, 'cruiser', 105, -6);
  pursuerBehind(world, vehicle, 'cruiser', 190, 40);
  pursuerBehind(world, vehicle, 'bulwark', 285, 0);
  run(world, input, 1.1, hold);
  world.banner = null;
}

function stageShootout(world) {
  const places = world.city.places;
  world.progress = 4;
  world.money = 15890;
  for (const [weapon, ammo] of [['pistol', 60], ['smg', 150], ['shotgun', 24]]) giveWeapon(world, weapon, ammo);
  const player = world.player;
  player.x = places.wharfYard.x - 40;
  player.y = places.wharfYard.y + 6;
  world.focus.x = player.x;
  world.focus.y = player.y;
  snapCamera(world.camera, player.x, player.y, 1.3);
  startMission(world, 4);
  world.dialogue = null;
  const cover = createVehicle('pelican', player.x + 170, player.y - 20, 0.5, '#c0c5ce');
  world.vehicles.push(cover);
  const cruiser = createVehicle('cruiser', player.x - 210, player.y + 26, 0.1);
  cruiser.siren = true;
  world.vehicles.push(cruiser);
  spawnOfficer(world, cruiser.x + 10, cruiser.y - 34, false);
  let placed = false;
  // Bring the Tidemen who spawned behind the container stacks out into the open.
  const gather = () => {
    let slot = 0;
    for (const person of world.people) {
      if (person.role !== 'gang') continue;
      placed = true;
      if (dist(person.x, person.y, player.x + 190, player.y + 20) < 190) continue;
      person.x = player.x + 130 + (slot % 3) * 85;
      person.y = player.y + 60 + Math.floor(slot / 3) * 70 + (slot % 2) * 30;
      slot += 1;
    }
  };
  const mouse = { x: 0, y: 0, down: true, clicked: false, wheel: 0 };
  const input = { ...createIdleInput(), mouse };
  let boomed = false;
  run(world, input, 3.4, (time) => {
    world.dayTime = 22.4;
    player.health = 76;
    player.armor = 40;
    world.inventory.ammo.rifle = 96;
    world.wanted.stars = 2;
    world.wanted.heat = 80;
    world.wanted.hidden = 0;
    if (!placed) gather();
    let target = null;
    let best = Infinity;
    for (const person of world.people) {
      if (person.role !== 'gang' || !person.alive) continue;
      person.ai.alert = true;
      const d = dist(person.x, person.y, player.x, player.y);
      if (d < best) {
        best = d;
        target = person;
      }
    }
    if (target) {
      const at = worldToScreen(world.camera, target.x, target.y);
      mouse.x = at.x;
      mouse.y = at.y;
    }
    if (!boomed && time > 3.05) {
      boomed = true;
      explode(world, cover.x, cover.y, 110, null);
    }
  });
  world.banner = null;
}

/** Build the named scene and return the world to draw; `title` says to draw the title screen over it. */
export function stageShot(name, city, seed, width, height) {
  seedRandom(seed);
  const attract = name !== 'drive' && name !== 'chase' && name !== 'shootout';
  const world = createWorld(city, { mode: attract ? 'attract' : 'play', audio: createSilentAudio() });
  resizeCamera(world.camera, width, height);
  if (attract) run(world, createIdleInput(), 9, null);
  else if (name === 'drive') stageDrive(world);
  else if (name === 'chase') stageChase(world);
  else stageShootout(world);
  return { world, title: attract };
}
