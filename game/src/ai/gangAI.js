// The Tidemen, Lucien Marrow's hired muscle: they guard a spot until they notice the player, then
// close to their weapon's range, strafe and open fire.
import { dist } from '../core/mathUtil.js';
import { rand, randRange } from '../core/random.js';
import { hasLineOfSight } from '../city/collision.js';
import { createPerson } from '../entities/person.js';
import { WEAPONS, attackWith } from '../combat/weapons.js';

export function spawnGangMember(world, x, y, weapon, tag) {
  const person = createPerson('gang', x, y);
  person.weapon = weapon;
  person.tag = tag ?? null;
  person.ai = { type: 'gang', alert: false, strafe: rand() < 0.5 ? -1 : 1, strafeTime: randRange(1, 2.5), pause: randRange(0.3, 1), burst: 0, aim: randRange(0.08, 0.15), homeX: x, homeY: y };
  world.people.push(person);
  return person;
}

/** One step of a gang member's thinking: sets where they walk and whether they shoot. */
export function thinkGang(world, person, dt) {
  const ai = person.ai;
  const weapon = WEAPONS[person.weapon];
  const tx = world.focus.x;
  const ty = world.focus.y;
  const d = dist(person.x, person.y, tx, ty);
  const sight = d < 520 && hasLineOfSight(world.city, person.x, person.y, tx, ty);
  if (!ai.alert) {
    person.moveX = 0;
    person.moveY = 0;
    person.angle += Math.sin(world.clock * 0.7 + person.id) * dt * 0.6;
    if (sight && d < 340 && world.mode === 'play') {
      ai.alert = true;
      for (const other of world.people) if (other.role === 'gang' && other.ai && dist(other.x, other.y, person.x, person.y) < 420) other.ai.alert = true;
    }
    return;
  }
  if (world.respawn) {
    person.moveX = 0;
    person.moveY = 0;
    return;
  }
  const angle = Math.atan2(ty - person.y, tx - person.x);
  person.angle = angle;
  const ideal = weapon.melee ? 16 : Math.min(190, weapon.range * 0.5);
  ai.strafeTime -= dt;
  if (ai.strafeTime <= 0) {
    ai.strafe = -ai.strafe;
    ai.strafeTime = randRange(0.8, 2.4);
  }
  let forward = 0;
  if (d > ideal + 30 || !sight) forward = 130;
  else if (d < ideal - 50) forward = -80;
  const side = weapon.melee || !sight ? 0 : ai.strafe * 70;
  person.moveX = Math.cos(angle) * forward - Math.sin(angle) * side;
  person.moveY = Math.sin(angle) * forward + Math.cos(angle) * side;
  if (!sight || d > weapon.range * 0.85) return;
  ai.pause -= dt;
  if (ai.pause > 0) return;
  if (attackWith(world, person, person.weapon, angle + (rand() - 0.5) * 2 * ai.aim, null)) {
    ai.burst += 1;
    if (ai.burst >= (weapon.auto ? 5 : weapon.melee ? 1 : 2)) {
      ai.burst = 0;
      ai.pause = randRange(0.6, 1.4);
    }
  }
}
