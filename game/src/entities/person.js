// A person on foot (the player, a pedestrian, an officer or a gang member): how they look and
// how their body moves and is knocked about.
import { approach } from '../core/mathUtil.js';
import { pick, rand } from '../core/random.js';
import { moveCircle } from '../city/collision.js';

const SKIN = ['#f1c9a5', '#e0ac7e', '#c68e63', '#9a6a45', '#70492d', '#f6d7bd'];
const HAIR = ['#1d1a18', '#3b2a1e', '#6b4a2b', '#c9a15a', '#8c8c8c', '#b5462f', '#101018'];
const SHIRTS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#f72585', '#ffffff', '#ff9f1c', '#b388eb', '#90be6d', '#f8ad9d', '#3d5a80'];
const PANTS = ['#2b3a55', '#3d3d3d', '#d9c7a3', '#5f7a8a', '#f2f2f2', '#7a4b3a', '#264653'];

let nextPersonId = 1;

function lookFor(role) {
  if (role === 'player') return { skin: '#b97a4f', hair: '#16130f', shirt: '#ff7a3d', pants: '#22324d', hat: null };
  if (role === 'cop') return { skin: pick(SKIN), hair: '#1d1a18', shirt: '#1f3b73', pants: '#16213e', hat: '#10203f' };
  if (role === 'gang') return { skin: pick(SKIN), hair: '#101018', shirt: '#16383a', pants: '#1b1b1f', hat: '#27d3c3' };
  return { skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRTS), pants: pick(PANTS), hat: rand() < 0.15 ? pick(SHIRTS) : null };
}

export function createPerson(role, x, y) {
  return {
    id: nextPersonId++,
    role,
    x,
    y,
    angle: rand() * Math.PI * 2,
    vx: 0,
    vy: 0,
    /** The velocity this person is trying to walk at; knocks are added on top and fade. */
    moveX: 0,
    moveY: 0,
    knockX: 0,
    knockY: 0,
    radius: 8,
    health: role === 'cop' ? 120 : role === 'gang' ? 90 : 60,
    armor: 0,
    alive: true,
    deadAge: 0,
    walkCycle: rand() * 6,
    look: lookFor(role),
    weapon: 'fists',
    cooldown: 0,
    punch: 0,
    muzzle: 0,
    vehicle: null,
    ai: null,
    cash: role === 'ped' ? 10 + Math.floor(rand() * 60) : role === 'gang' ? 80 + Math.floor(rand() * 120) : 0,
    tag: null,
  };
}

/** Move a living person's body for one step, sliding along walls. */
export function stepPersonBody(city, person, dt) {
  person.vx = approach(person.vx, person.moveX, 900 * dt);
  person.vy = approach(person.vy, person.moveY, 900 * dt);
  const dx = (person.vx + person.knockX) * dt;
  const dy = (person.vy + person.knockY) * dt;
  const hit = moveCircle(city, person, dx, dy, person.radius);
  const fade = Math.exp(-6 * dt);
  person.knockX *= fade;
  person.knockY *= fade;
  person.walkCycle += Math.hypot(person.vx, person.vy) * dt * 0.085;
  if (person.cooldown > 0) person.cooldown -= dt;
  if (person.punch > 0) person.punch -= dt;
  if (person.muzzle > 0) person.muzzle -= dt;
  return hit;
}
