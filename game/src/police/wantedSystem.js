// The wanted level: crimes seen by a witness add heat, heat becomes one to five stars, and the
// stars fade only after the player has stayed out of the police's sight for long enough.
import { WANTED_TUNING } from '../core/config.js';
import { dist } from '../core/mathUtil.js';
import { hasLineOfSight } from '../city/collision.js';

/** Heat per crime; `always` crimes need no witness (the police themselves saw them). */
const CRIMES = {
  gunfire: { heat: 6 },
  assault: { heat: 14 },
  murder: { heat: 36 },
  carjack: { heat: 22 },
  hitAndRun: { heat: 30 },
  explosion: { heat: 48 },
  copCarHit: { heat: 10, always: true },
  copCarTheft: { heat: 75, always: true },
  copAssault: { heat: 60, always: true },
  copKill: { heat: 130, always: true },
};

export function createWanted() {
  return { heat: 0, stars: 0, seen: false, hidden: 0, lastX: 0, lastY: 0, pulse: 0 };
}

function starsForHeat(heat) {
  let stars = 0;
  for (let n = 1; n < WANTED_TUNING.thresholds.length; n += 1) if (heat >= WANTED_TUNING.thresholds[n]) stars = n;
  return stars;
}

function hasWitness(world, x, y) {
  for (const person of world.people) {
    if (!person.alive || person === world.player || person.role === 'gang') continue;
    if (dist(person.x, person.y, x, y) < WANTED_TUNING.witnessRange) return true;
  }
  for (const vehicle of world.vehicles) {
    if (vehicle.driver === 'ai' && dist(vehicle.x, vehicle.y, x, y) < WANTED_TUNING.witnessRange) return true;
  }
  return false;
}

/** The player committed a crime at (x, y). */
export function reportCrime(world, type, x, y) {
  if (world.mode === 'attract') return;
  const crime = CRIMES[type];
  if (!crime.always && !hasWitness(world, x, y)) return;
  const wanted = world.wanted;
  wanted.heat += crime.heat;
  const stars = Math.max(wanted.stars, starsForHeat(wanted.heat));
  if (stars > wanted.stars) {
    wanted.stars = stars;
    wanted.pulse = 1;
    world.audio.play('wanted');
  }
  wanted.hidden = 0;
  wanted.lastX = world.focus.x;
  wanted.lastY = world.focus.y;
}

/** Force the wanted level to at least `stars` (missions use this). */
export function raiseWanted(world, stars) {
  const wanted = world.wanted;
  if (stars <= wanted.stars) return;
  wanted.stars = stars;
  wanted.heat = Math.max(wanted.heat, WANTED_TUNING.thresholds[stars]);
  wanted.hidden = 0;
  wanted.pulse = 1;
  wanted.lastX = world.focus.x;
  wanted.lastY = world.focus.y;
  world.audio.play('wanted');
}

export function clearWanted(world) {
  world.wanted.heat = 0;
  world.wanted.stars = 0;
  world.wanted.hidden = 0;
  world.wanted.seen = false;
}

/** Seconds out of sight needed to lose the current wanted level. */
export function searchDuration(stars) {
  return WANTED_TUNING.searchBase + WANTED_TUNING.searchPerStar * stars;
}

function policeSeePlayer(world) {
  const { x, y } = world.focus;
  for (const person of world.people) {
    if (person.role !== 'cop' || !person.alive) continue;
    if (dist(person.x, person.y, x, y) < WANTED_TUNING.sightRange && hasLineOfSight(world.city, person.x, person.y, x, y)) return true;
  }
  for (const vehicle of world.vehicles) {
    if (!vehicle.police || vehicle.driver !== 'ai') continue;
    if (dist(vehicle.x, vehicle.y, x, y) < WANTED_TUNING.sightRange && hasLineOfSight(world.city, vehicle.x, vehicle.y, x, y)) return true;
  }
  const heli = world.police.heli;
  return Boolean(heli && !heli.leaving && dist(heli.lightX, heli.lightY, x, y) < 120);
}

export function stepWanted(world, dt) {
  const wanted = world.wanted;
  if (wanted.pulse > 0) wanted.pulse -= dt;
  if (wanted.stars === 0) {
    wanted.heat = Math.max(0, wanted.heat - dt * 1.5);
    wanted.seen = false;
    return;
  }
  wanted.seen = policeSeePlayer(world);
  if (wanted.seen) {
    wanted.hidden = 0;
    wanted.lastX = world.focus.x;
    wanted.lastY = world.focus.y;
    return;
  }
  wanted.hidden += dt;
  if (wanted.hidden >= searchDuration(wanted.stars)) {
    clearWanted(world);
    world.toast('You lost the heat.');
    world.events.push({ type: 'wantedCleared' });
  }
}
