// The Bay Cab side job: on duty in a taxi (G), pick up a fare at the kerb, race them across town
// before their patience runs out, and get paid by distance with a tip for speed.
import { dist, formatMoney } from '../core/mathUtil.js';
import { findPavementNear } from '../ai/pedestrianAI.js';
import { vehicleSpeed } from '../entities/vehicle.js';

export function createTaxi() {
  return { active: false, phase: 'pickup', target: null, timer: 0, fare: 0, streak: 0 };
}

function nextPickup(world, taxi) {
  taxi.phase = 'pickup';
  taxi.target = findPavementNear(world, world.focus.x, world.focus.y, 320, 900);
  taxi.timer = 0;
}

function stopDuty(world, taxi, message) {
  taxi.active = false;
  taxi.streak = 0;
  if (message) world.toast(message);
}

export function stepTaxi(world, input, dt) {
  const taxi = world.taxi;
  const vehicle = world.player.vehicle;
  const inCab = Boolean(vehicle && vehicle.kind.id === 'cab');
  if (inCab && !world.mission && input.pressed('KeyG')) {
    if (taxi.active) stopDuty(world, taxi, 'Off duty.');
    else {
      taxi.active = true;
      nextPickup(world, taxi);
      world.toast('Bay Cab on duty. Pick up the fare.');
    }
  }
  if (!taxi.active) return;
  if (!inCab || world.mission || world.respawn) {
    stopDuty(world, taxi, inCab ? null : 'You left the cab. Off duty.');
    return;
  }
  const gap = dist(vehicle.x, vehicle.y, taxi.target.x, taxi.target.y);
  const stopped = gap < 70 && vehicleSpeed(vehicle) < 35;
  if (taxi.phase === 'pickup') {
    world.objective = 'Bay Cab: pick up the fare';
    world.markers.push({ x: taxi.target.x, y: taxi.target.y, kind: 'fare', color: '#ffb703', radius: 46 });
    if (stopped) {
      const from = taxi.target;
      taxi.target = findPavementNear(world, from.x, from.y, 900, 2300);
      const trip = dist(from.x, from.y, taxi.target.x, taxi.target.y);
      taxi.phase = 'ride';
      taxi.fare = Math.round(40 + trip * 0.11);
      taxi.timer = 22 + trip / 9;
      world.audio.play('door', vehicle.x, vehicle.y);
      world.toast(`Fare aboard · ${formatMoney(taxi.fare)} on the meter.`);
    }
    return;
  }
  taxi.timer -= dt;
  world.objective = 'Bay Cab: drop the fare off';
  world.missionTimer = taxi.timer;
  world.markers.push({ x: taxi.target.x, y: taxi.target.y, kind: 'goal', color: '#ffb703', radius: 46 });
  if (taxi.timer <= 0) {
    world.toast('The fare bailed out. No pay.');
    taxi.streak = 0;
    nextPickup(world, taxi);
  } else if (stopped) {
    const tip = Math.round(taxi.timer * 2) + taxi.streak * 25;
    taxi.streak += 1;
    world.stats.fares += 1;
    world.addMoney(taxi.fare + tip, vehicle.x, vehicle.y);
    world.toast(`Fare paid ${formatMoney(taxi.fare)} + ${formatMoney(tip)} tip · streak ${taxi.streak}`);
    world.audio.play('pickup');
    nextPickup(world, taxi);
  }
}
