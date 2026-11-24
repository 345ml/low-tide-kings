// The whole simulated world and its one step: the city, Dani, every vehicle and person, the
// police, missions, pickups and effects, advanced together in a fixed order.
import { PLAYER_TUNING, POPULATION } from '../core/config.js';
import { dist, formatMoney } from '../core/mathUtil.js';
import { rand } from '../core/random.js';
import { createCamera, isOnScreen, snapCamera, updateCamera } from '../render/camera.js';
import { createEffects, stepEffects } from '../render/effects.js';
import { stepPersonBody } from '../entities/person.js';
import { controlPlayer, createInventory, createPlayer } from '../entities/player.js';
import { collideVehicles, stepVehicle, vehicleSpeed } from '../entities/vehicle.js';
import { driveTraffic, fillParkingSpots, populateTraffic } from '../ai/trafficAI.js';
import { populatePedestrians, thinkPedestrian } from '../ai/pedestrianAI.js';
import { thinkGang } from '../ai/gangAI.js';
import { damagePerson, damageVehicle, wreckVehicle } from '../combat/damage.js';
import { createWanted, reportCrime, stepWanted } from '../police/wantedSystem.js';
import { createPolice, drivePursuit, stepPolice, thinkOfficer } from '../police/policeForce.js';
import { stepMissions } from '../missions/missionRunner.js';
import { createTaxi, stepTaxi } from '../missions/taxiJob.js';
import { applySave, writeSave } from '../save/saveGame.js';
import { stepDayTime } from './dayNight.js';
import { placeWorldPickups, stepPickups } from './pickups.js';
import { respawnPlayer, stepServices } from './services.js';

const START_MONEY = 150;

/**
 * Make a world on a generated city. `mode` is 'play', or 'attract' for the title screen's living
 * backdrop (no player on the streets). `save` is saved progress to continue from, or null.
 */
export function createWorld(city, { mode = 'play', audio, save = null }) {
  const start = save ? city.places.safehouse : city.places.arrival;
  const world = {
    city,
    mode,
    audio,
    clock: 0,
    dayTime: 9.5,
    player: createPlayer(start.x, start.y),
    inventory: createInventory(),
    vehicles: [],
    people: [],
    pickups: [],
    markers: [],
    events: [],
    fx: createEffects(),
    camera: createCamera(),
    wanted: createWanted(),
    police: createPolice(),
    taxi: createTaxi(),
    focus: { x: start.x, y: start.y },
    money: START_MONEY,
    progress: 0,
    stats: { kills: 0, fares: 0, missions: 0, conchs: [] },
    mission: null,
    missionCooldown: 0,
    dialogue: null,
    shop: null,
    respawn: null,
    objective: '',
    missionTimer: null,
    prompt: '',
    banner: null,
    toasts: [],
    hurtFlash: 0,
    saveRequested: false,
    toast(text) {
      if (world.toasts.length && world.toasts[world.toasts.length - 1].text === text) {
        world.toasts[world.toasts.length - 1].time = 4;
        return;
      }
      world.toasts.push({ text, time: 4 });
      if (world.toasts.length > 4) world.toasts.shift();
    },
    shake(amount) {
      world.camera.shake = Math.max(world.camera.shake, amount);
    },
    kick(angle, amount) {
      world.camera.kickX -= Math.cos(angle) * amount;
      world.camera.kickY -= Math.sin(angle) * amount;
    },
    addMoney(amount, x, y) {
      world.money += amount;
      if (x !== undefined) world.fx.text(x, y, `+${formatMoney(amount)}`, '#7dff9b');
    },
  };
  if (save) applySave(world, save);
  if (mode === 'attract') {
    world.focus.x = city.places.beachNorth.x;
    world.focus.y = city.places.beachNorth.y;
    world.dayTime = 17.4;
  } else world.people.push(world.player);
  snapCamera(world.camera, world.focus.x, world.focus.y, mode === 'attract' ? 0.95 : 1.3);
  fillParkingSpots(world);
  placeWorldPickups(world);
  populateTraffic(world);
  populatePedestrians(world);
  return world;
}

function stepAttractFocus(world, dt) {
  const places = world.city.places;
  const t = (Math.sin(world.clock * 0.035 - 1.2) + 1) / 2;
  world.focus.x = places.beachNorth.x + 190 + Math.sin(world.clock * 0.11) * 40;
  world.focus.y = places.beachNorth.y + (places.beachSouth.y - places.beachNorth.y) * t;
  if (dt > 0) world.player.aimAngle = 0;
}

function stepVehicles(world, dt) {
  const vehicles = world.vehicles;
  const player = world.player;
  for (const vehicle of vehicles) {
    if (vehicle.ai && !vehicle.wrecked) {
      if (vehicle.ai.type === 'traffic') driveTraffic(world, vehicle, dt);
      else if (vehicle.ai.type === 'pursuit') drivePursuit(world, vehicle, dt);
    }
    const impact = stepVehicle(world.city, vehicle, dt);
    if (impact > 130) {
      damageVehicle(world, vehicle, (impact - 110) * 0.075, null);
      world.fx.sparks(vehicle.x + Math.cos(vehicle.angle) * 20, vehicle.y + Math.sin(vehicle.angle) * 20, 6);
      world.audio.play('crash', vehicle.x, vehicle.y);
      if (vehicle.driver === 'player') world.shake(Math.min(12, impact / 30));
    }
    if (vehicle.skidding > 0 && !vehicle.wrecked) {
      const cos = Math.cos(vehicle.angle);
      const sin = Math.sin(vehicle.angle);
      const back = vehicle.kind.length * 0.32;
      const side = vehicle.kind.width * 0.4;
      world.fx.skid(vehicle.x - cos * back - sin * side, vehicle.y - sin * back + cos * side, vehicle.angle, vehicle.skidding * 0.8);
      world.fx.skid(vehicle.x - cos * back + sin * side, vehicle.y - sin * back - cos * side, vehicle.angle, vehicle.skidding * 0.8);
      if (rand() < 0.2) world.fx.dust(vehicle.x - cos * back, vehicle.y - sin * back);
    }
    if (vehicle.burning > 0) {
      vehicle.burning -= dt;
      world.fx.fire(vehicle.x + Math.cos(vehicle.angle) * 12, vehicle.y + Math.sin(vehicle.angle) * 12, 7);
      if (rand() < 0.4) world.fx.smoke(vehicle.x, vehicle.y, 7, true);
      if (vehicle.burning <= 0) wreckVehicle(world, vehicle, vehicle.lastAttacker ?? null);
    } else if (!vehicle.wrecked && vehicle.health < vehicle.kind.health * 0.4 && rand() < 0.25) {
      world.fx.smoke(vehicle.x + Math.cos(vehicle.angle) * 14, vehicle.y + Math.sin(vehicle.angle) * 14, 4, vehicle.health < vehicle.kind.health * 0.2);
    } else if (vehicle.wrecked) {
      vehicle.wreckAge += dt;
      if (vehicle.wreckAge < 14 && rand() < 0.15) world.fx.smoke(vehicle.x, vehicle.y, 6, true);
    }
  }
  // Vehicle against vehicle.
  for (let i = 0; i < vehicles.length; i += 1) {
    const a = vehicles[i];
    for (let j = i + 1; j < vehicles.length; j += 1) {
      const b = vehicles[j];
      if (Math.abs(a.x - b.x) > 90 || Math.abs(a.y - b.y) > 90) continue;
      const closing = collideVehicles(a, b);
      if (closing < 80) continue;
      const hurt = (closing - 60) * 0.085;
      const byPlayer = a.driver === 'player' || b.driver === 'player';
      damageVehicle(world, a, hurt, b.driver === 'player' ? player : null);
      damageVehicle(world, b, hurt, a.driver === 'player' ? player : null);
      world.fx.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 8);
      world.audio.play('crash', a.x, a.y);
      if (byPlayer) world.shake(Math.min(12, closing / 28));
    }
  }
  // Vehicles against people on foot.
  for (const vehicle of vehicles) {
    const speed = vehicleSpeed(vehicle);
    if (speed < 20) continue;
    const reach = vehicle.kind.length * 0.5 + 10;
    for (const person of world.people) {
      if (!person.alive || person.vehicle) continue;
      const dx = person.x - vehicle.x;
      const dy = person.y - vehicle.y;
      if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
      const cos = Math.cos(vehicle.angle);
      const sin = Math.sin(vehicle.angle);
      const along = dx * cos + dy * sin;
      const across = -dx * sin + dy * cos;
      if (Math.abs(along) > vehicle.kind.length * 0.5 + 5 || Math.abs(across) > vehicle.kind.width * 0.5 + 6) continue;
      const push = across >= 0 ? 1 : -1;
      person.knockX += -sin * push * 120 + vehicle.vx * 0.6;
      person.knockY += cos * push * 120 + vehicle.vy * 0.6;
      if (speed > 75 && (person.hitCooldown ?? 0) <= 0) {
        person.hitCooldown = 0.5;
        const driver = vehicle.driver === 'player' ? player : null;
        damagePerson(world, person, (speed - 45) * 0.55, driver, Math.atan2(vehicle.vy, vehicle.vx));
        if (driver && person.role === 'ped') reportCrime(world, 'hitAndRun', person.x, person.y);
        world.audio.play('thud', person.x, person.y);
        vehicle.vx *= 0.93;
        vehicle.vy *= 0.93;
      }
    }
  }
}

function stepPeople(world, dt) {
  for (const person of world.people) {
    if (person.hitCooldown > 0) person.hitCooldown -= dt;
    if (!person.alive) {
      person.deadAge += dt;
      continue;
    }
    if (person.vehicle) continue;
    if (person.ai) {
      if (person.ai.type === 'ped') thinkPedestrian(world, person, dt);
      else if (person.ai.type === 'gang') thinkGang(world, person, dt);
      else if (person.ai.type === 'cop') thinkOfficer(world, person, dt);
    }
    stepPersonBody(world.city, person, dt);
  }
}

/** Remove what is finished or far away so the world stays small around the player. */
function sweep(world) {
  const { x, y } = world.focus;
  world.vehicles = world.vehicles.filter((vehicle) => {
    if (vehicle.remove) return vehicle.driver === 'player';
    if (vehicle.driver === 'player' || vehicle.tag) return true;
    const d = dist(vehicle.x, vehicle.y, x, y);
    const seen = isOnScreen(world.camera, vehicle.x, vehicle.y, 80);
    if (vehicle.wrecked) return vehicle.wreckAge < 45 || seen;
    if (vehicle.ai) return d < POPULATION.despawn || (vehicle.ai.type === 'pursuit' && d < 2200);
    if (vehicle.home && !vehicle.moved) return true;
    if (vehicle.police && vehicle.emptiedAt !== undefined) return seen || world.clock - vehicle.emptiedAt < 30;
    return d < POPULATION.despawn + 300;
  });
  world.people = world.people.filter((person) => {
    if (person === world.player) return true;
    if (person.remove) return false;
    const d = dist(person.x, person.y, x, y);
    if (!person.alive) return person.deadAge < 30 && d < POPULATION.despawn;
    if (person.tag) return true;
    if (person.role === 'cop') return !(person.ai.leaving && d > 520 && !isOnScreen(world.camera, person.x, person.y, 20)) && d < 1600;
    return d < POPULATION.despawn - 200;
  });
}

/** Advance the whole world by one fixed step. */
export function stepWorld(world, input, dt) {
  const player = world.player;
  world.clock += dt;
  world.markers.length = 0;
  world.events.length = 0;
  world.objective = '';
  world.missionTimer = null;
  world.prompt = '';
  stepDayTime(world, dt);

  if (world.mode === 'attract') stepAttractFocus(world, dt);
  else {
    controlPlayer(world, input, dt);
    const body = player.vehicle ?? player;
    world.focus.x = body.x;
    world.focus.y = body.y;
  }

  populateTraffic(world);
  populatePedestrians(world);
  stepVehicles(world, dt);
  stepPeople(world, dt);
  if (player.vehicle) {
    player.x = player.vehicle.x;
    player.y = player.vehicle.y;
    if (player.vehicle.home) player.vehicle.moved = true;
  }
  if (world.mode !== 'attract') {
    world.focus.x = player.x;
    world.focus.y = player.y;
  }

  stepWanted(world, dt);
  stepPolice(world, dt);
  stepPickups(world, dt);
  stepMissions(world, dt);
  stepTaxi(world, input, dt);
  stepServices(world, input, dt);
  stepEffects(world.fx, dt);

  if (world.respawn) {
    world.respawn.timer -= dt;
    if (world.respawn.timer <= 0) {
      const kind = world.respawn.kind;
      world.respawn = null;
      respawnPlayer(world, kind);
      world.focus.x = player.x;
      world.focus.y = player.y;
      snapCamera(world.camera, player.x, player.y);
    }
  }
  if (player.alive && player.health < PLAYER_TUNING.maxHealth * 0.3 && world.wanted.stars === 0) player.health = Math.min(PLAYER_TUNING.maxHealth * 0.3, player.health + dt * 1.5);
  if (world.hurtFlash > 0) world.hurtFlash -= dt;
  if (world.banner) {
    world.banner.time -= dt;
    if (world.banner.time <= 0) world.banner = null;
  }
  for (let index = world.toasts.length - 1; index >= 0; index -= 1) {
    world.toasts[index].time -= dt;
    if (world.toasts[index].time <= 0) world.toasts.splice(index, 1);
  }
  sweep(world);
  updateCamera(world.camera, world, dt);
  if (world.saveRequested) {
    world.saveRequested = false;
    if (world.mode === 'play' && !writeSave(world)) world.toast('Saving is not available in this browser window.');
  }
}
