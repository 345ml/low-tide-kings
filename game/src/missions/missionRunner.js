// Plays the story missions: starts one when the player walks into its marker, runs its steps
// (talk, go somewhere, clear out enemies, collect, steal, deliver, lose the police, wreck a car),
// keeps the objective and map markers current, and handles passing and failing.
import { dist, formatMoney } from '../core/mathUtil.js';
import { pick, randRange } from '../core/random.js';
import { circleBlocked } from '../city/collision.js';
import { nearestNode } from '../city/roadGraph.js';
import { createVehicle, vehicleSpeed } from '../entities/vehicle.js';
import { exitVehicle, giveWeapon } from '../entities/player.js';
import { spawnGangMember } from '../ai/gangAI.js';
import { giveTrafficDriver } from '../ai/trafficAI.js';
import { WEAPONS } from '../combat/weapons.js';
import { raiseWanted } from '../police/wantedSystem.js';
import { dropPickup } from '../world/pickups.js';
import { STORY_MISSIONS } from './storyMissions.js';

const START_RADIUS = 40;

function placeOf(world, place) {
  return typeof place === 'string' ? world.city.places[place] : place;
}

function freeSpotNear(world, spot, spread) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = spot.x + randRange(-spread, spread);
    const y = spot.y + randRange(-spread, spread);
    if (!circleBlocked(world.city, x, y, 12)) return { x, y };
  }
  return { x: spot.x, y: spot.y };
}

export function startMission(world, index) {
  const def = STORY_MISSIONS[index];
  world.mission = { def, index, stepIndex: -1, timer: null, vehicle: null, actors: [], items: [], target: null, entered: false };
  world.banner = { title: def.title, subtitle: `Mission ${index + 1} of ${STORY_MISSIONS.length}`, color: '#ffc94a', time: 4 };
  world.audio.play('missionStart');
  advance(world);
}

function advance(world) {
  const mission = world.mission;
  mission.stepIndex += 1;
  mission.timer = null;
  mission.target = null;
  if (mission.stepIndex >= mission.def.steps.length) {
    completeMission(world);
    return;
  }
  const step = mission.def.steps[mission.stepIndex];
  if (step.timer) mission.timer = step.timer;
  if (step.kind === 'talk') {
    world.dialogue = { lines: step.lines, index: 0 };
  } else if (step.kind === 'give') {
    giveWeapon(world, step.weapon, step.ammo);
    world.toast(`You got the ${WEAPONS[step.weapon].name}.`);
    advance(world);
  } else if (step.kind === 'time') {
    world.dayTime = step.hour;
    advance(world);
  } else if (step.kind === 'goto' || step.kind === 'deliver') {
    mission.target = placeOf(world, step.place);
  } else if (step.kind === 'eliminate') {
    const spot = placeOf(world, step.place);
    mission.actors = step.crew.map((weapon) => {
      const at = freeSpotNear(world, spot, step.spread ?? 90);
      return spawnGangMember(world, at.x, at.y, weapon, 'mission');
    });
    mission.target = spot;
  } else if (step.kind === 'collect') {
    mission.items = step.places.map((place) => {
      const spot = placeOf(world, place);
      return dropPickup(world, 'item', spot.x, spot.y, 0, { tag: 'mission' });
    });
  } else if (step.kind === 'steal') {
    const spot = placeOf(world, step.place);
    const vehicle = createVehicle(step.vehicle, spot.x, spot.y, 0, step.color);
    vehicle.tag = 'mission';
    vehicle.parked = true;
    world.vehicles.push(vehicle);
    mission.vehicle = vehicle;
  } else if (step.kind === 'lose') {
    raiseWanted(world, step.stars);
  } else if (step.kind === 'destroy') {
    const spot = placeOf(world, step.place);
    const graph = world.city.graph;
    const node = nearestNode(graph, spot.x, spot.y);
    const vehicle = createVehicle(step.vehicle, node.x, node.y + 32, 0, '#15171c');
    giveTrafficDriver(world, vehicle, node.id, pick(node.links).node);
    vehicle.ai.panic = 99999;
    vehicle.ai.cruise = 190;
    vehicle.ai.reckless = true;
    vehicle.tag = 'mission';
    world.vehicles.push(vehicle);
    mission.vehicle = vehicle;
  }
}

function cleanUp(world, removeEverything) {
  const mission = world.mission;
  if (!mission) return;
  for (const item of mission.items) {
    const at = world.pickups.indexOf(item);
    if (at >= 0) world.pickups.splice(at, 1);
  }
  if (removeEverything) {
    for (const actor of mission.actors) if (actor.alive) actor.remove = true;
    if (mission.vehicle && mission.vehicle.driver !== 'player') mission.vehicle.remove = true;
  }
  if (mission.vehicle) mission.vehicle.tag = null;
  world.mission = null;
  world.missionCooldown = 7;
  world.objective = '';
  world.missionTimer = null;
}

function completeMission(world) {
  const mission = world.mission;
  const def = mission.def;
  world.addMoney(def.reward);
  if (def.gift) {
    giveWeapon(world, def.gift.weapon, def.gift.ammo);
    world.toast(`Unlocked: ${WEAPONS[def.gift.weapon].name}.`);
  }
  world.progress = Math.max(world.progress, mission.index + 1);
  world.stats.missions = world.progress;
  const last = world.progress >= STORY_MISSIONS.length;
  world.banner = { title: 'MISSION PASSED', subtitle: `${def.title} · ${formatMoney(def.reward)}${last ? ' · The bay is yours' : ''}`, color: '#7dff9b', time: 5 };
  world.audio.play('missionPassed');
  cleanUp(world, false);
  world.saveRequested = true;
}

export function failMission(world, reason) {
  if (!world.mission) return;
  world.banner = { title: 'MISSION FAILED', subtitle: reason, color: '#ff4d4d', time: 4.5 };
  world.audio.play('missionFailed');
  world.dialogue = null;
  cleanUp(world, true);
}

/** Markers for the HUD, minimap and world: where to go and what to deal with. */
function publishMarkers(world) {
  const mission = world.mission;
  const markers = world.markers;
  if (!mission) {
    if (world.progress < STORY_MISSIONS.length && world.mode === 'play') {
      const def = STORY_MISSIONS[world.progress];
      const spot = placeOf(world, def.start);
      markers.push({ x: spot.x, y: spot.y, kind: 'start', label: def.giver[0], color: '#ffc94a', radius: START_RADIUS, title: def.title });
    }
    return;
  }
  const step = mission.def.steps[mission.stepIndex];
  if (!step) return;
  if (mission.target && (step.kind === 'goto' || step.kind === 'deliver')) markers.push({ x: mission.target.x, y: mission.target.y, kind: 'goal', color: '#ffc94a', radius: step.radius ?? 46 });
  if (step.kind === 'eliminate') for (const actor of mission.actors) if (actor.alive) markers.push({ x: actor.x, y: actor.y, kind: 'enemy', color: '#ff4d4d', radius: 0 });
  if (step.kind === 'collect') for (const item of mission.items) if (world.pickups.includes(item)) markers.push({ x: item.x, y: item.y, kind: 'item', color: '#7dff9b', radius: 0 });
  if (mission.vehicle && !mission.vehicle.wrecked && (step.kind === 'steal' || step.kind === 'destroy' || (step.kind === 'deliver' && world.player.vehicle !== mission.vehicle))) {
    markers.push({ x: mission.vehicle.x, y: mission.vehicle.y, kind: step.kind === 'destroy' ? 'enemy' : 'vehicle', color: step.kind === 'destroy' ? '#ff4d4d' : '#4cc9f0', radius: 0 });
  }
}

export function stepMissions(world, dt) {
  const mission = world.mission;
  if (!mission) {
    world.missionCooldown = Math.max(0, world.missionCooldown - dt);
    if (world.mode === 'play' && world.progress < STORY_MISSIONS.length && !world.respawn && world.wanted.stars === 0 && world.missionCooldown <= 0) {
      const spot = placeOf(world, STORY_MISSIONS[world.progress].start);
      const slow = !world.player.vehicle || vehicleSpeed(world.player.vehicle) < 60;
      if (slow && dist(world.focus.x, world.focus.y, spot.x, spot.y) < START_RADIUS) startMission(world, world.progress);
    }
    publishMarkers(world);
    return;
  }
  if (world.respawn) {
    failMission(world, world.respawn.kind === 'busted' ? 'You were arrested.' : 'You were taken out.');
    publishMarkers(world);
    return;
  }
  const step = mission.def.steps[mission.stepIndex];
  const player = world.player;
  world.objective = step.text ?? '';
  if (mission.timer !== null) {
    mission.timer -= dt;
    if (mission.timer <= 0) {
      failMission(world, 'You ran out of time.');
      publishMarkers(world);
      return;
    }
  }
  world.missionTimer = mission.timer;
  if (mission.vehicle && mission.vehicle.wrecked && (step.kind === 'steal' || step.kind === 'deliver' || step.kind === 'lose') ) {
    failMission(world, 'The car was destroyed.');
    publishMarkers(world);
    return;
  }

  let done = false;
  if (step.kind === 'talk') done = world.dialogue === null;
  else if (step.kind === 'goto') done = dist(world.focus.x, world.focus.y, mission.target.x, mission.target.y) < (step.radius ?? 46);
  else if (step.kind === 'eliminate') done = mission.actors.every((actor) => !actor.alive);
  else if (step.kind === 'collect') done = mission.items.every((item) => !world.pickups.includes(item));
  else if (step.kind === 'steal') {
    done = player.vehicle === mission.vehicle;
  } else if (step.kind === 'lose') {
    done = world.wanted.stars === 0;
  } else if (step.kind === 'deliver') {
    if (player.vehicle !== mission.vehicle) world.objective = 'Get back in the car';
    else done = dist(world.focus.x, world.focus.y, mission.target.x, mission.target.y) < 50 && vehicleSpeed(mission.vehicle) < 50;
    if (done) {
      exitVehicle(world);
      if (player.vehicle) {
        player.vehicle.driver = null;
        player.vehicle = null;
      }
      mission.vehicle.remove = true;
    }
  } else if (step.kind === 'destroy') {
    done = mission.vehicle.wrecked || mission.vehicle.burning > 0;
  }
  if (done) advance(world);
  publishMarkers(world);
}
