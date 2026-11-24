// Dani Okoro under the player's hands: walking and sprinting, aiming with the mouse, fighting,
// switching weapons, stealing and leaving vehicles, and driving.
import { PLAYER_TUNING } from '../core/config.js';
import { dist } from '../core/mathUtil.js';
import { circleBlocked } from '../city/collision.js';
import { screenToWorld } from '../render/camera.js';
import { spawnPedestrian } from '../ai/pedestrianAI.js';
import { WEAPONS, WEAPON_ORDER, attackWith } from '../combat/weapons.js';
import { reportCrime } from '../police/wantedSystem.js';
import { spawnOfficer } from '../police/policeForce.js';
import { createPerson } from './person.js';
import { doorPosition, vehicleSpeed } from './vehicle.js';

const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

export function createPlayer(x, y) {
  const player = createPerson('player', x, y);
  player.health = PLAYER_TUNING.maxHealth;
  player.radius = PLAYER_TUNING.radius;
  player.aimAngle = 0;
  return player;
}

export function createInventory() {
  return { owned: { fists: true }, ammo: {}, current: 'fists' };
}

/** Give the player a weapon (and ammunition for it), switching to it when it is new. */
export function giveWeapon(world, weaponId, ammo) {
  const inventory = world.inventory;
  if (!inventory.owned[weaponId]) inventory.current = weaponId;
  inventory.owned[weaponId] = true;
  inventory.ammo[weaponId] = (inventory.ammo[weaponId] ?? 0) + ammo;
}

function cycleWeapon(inventory, direction) {
  let index = WEAPON_ORDER.indexOf(inventory.current);
  for (let n = 0; n < WEAPON_ORDER.length; n += 1) {
    index = (index + direction + WEAPON_ORDER.length) % WEAPON_ORDER.length;
    if (inventory.owned[WEAPON_ORDER[index]]) break;
  }
  inventory.current = WEAPON_ORDER[index];
}

/** The nearest vehicle the player could get into, or null. */
export function nearestEnterable(world) {
  const player = world.player;
  let best = null;
  let bestDistance = Infinity;
  for (const vehicle of world.vehicles) {
    if (vehicle.wrecked || vehicle.burning > 0) continue;
    const d = dist(vehicle.x, vehicle.y, player.x, player.y) - vehicle.kind.length * 0.3;
    if (d < PLAYER_TUNING.enterRange - 20 && d < bestDistance) {
      best = vehicle;
      bestDistance = d;
    }
  }
  return best;
}

/** Take the wheel of a vehicle, throwing out whoever was driving. */
export function enterVehicle(world, vehicle) {
  const player = world.player;
  if (vehicle.driver === 'ai') {
    const door = doorPosition(vehicle, 1);
    if (vehicle.police) {
      const cop = spawnOfficer(world, door.x, door.y, vehicle.kind.body === 'armored');
      cop.ai.provoked = true;
      reportCrime(world, 'copCarTheft', vehicle.x, vehicle.y);
    } else {
      const driver = spawnPedestrian(world, door.x, door.y);
      driver.ai.mode = 'flee';
      driver.ai.fleeX = vehicle.x;
      driver.ai.fleeY = vehicle.y;
      driver.ai.fleeTime = 9;
      reportCrime(world, 'carjack', vehicle.x, vehicle.y);
    }
    world.audio.play('grunt', vehicle.x, vehicle.y);
  } else if (vehicle.police) reportCrime(world, 'copCarTheft', vehicle.x, vehicle.y);
  vehicle.driver = 'player';
  vehicle.ai = null;
  vehicle.parked = false;
  vehicle.handbrake = false;
  player.vehicle = vehicle;
  player.moveX = 0;
  player.moveY = 0;
  player.vx = 0;
  player.vy = 0;
  world.audio.play('door', vehicle.x, vehicle.y);
  world.events.push({ type: 'enter', vehicle });
}

export function exitVehicle(world) {
  const player = world.player;
  const vehicle = player.vehicle;
  if (!vehicle) return;
  for (const side of [-1, 1]) {
    const door = doorPosition(vehicle, side);
    if (circleBlocked(world.city, door.x, door.y, player.radius)) continue;
    player.x = door.x;
    player.y = door.y;
    player.knockX = vehicle.vx * 0.5;
    player.knockY = vehicle.vy * 0.5;
    player.vehicle = null;
    vehicle.driver = null;
    vehicle.throttle = 0;
    vehicle.steer = 0;
    vehicle.handbrake = vehicleSpeed(vehicle) < 60;
    world.audio.play('door', vehicle.x, vehicle.y);
    world.events.push({ type: 'exit', vehicle });
    return;
  }
}

function useWeapon(world, input, player) {
  const inventory = world.inventory;
  if (input.mouse.wheel !== 0) cycleWeapon(inventory, input.mouse.wheel > 0 ? 1 : -1);
  if (input.pressed('KeyQ')) cycleWeapon(inventory, 1);
  for (let n = 0; n < WEAPON_ORDER.length; n += 1) {
    if (input.pressed(`Digit${n + 1}`) && inventory.owned[WEAPON_ORDER[n]]) inventory.current = WEAPON_ORDER[n];
  }
  player.weapon = inventory.current;
  const weapon = WEAPONS[inventory.current];
  const trigger = player.vehicle ? input.mouse.down : input.mouse.down || input.down('Space');
  const tapped = input.mouse.clicked || (!player.vehicle && input.pressed('Space'));
  if (player.vehicle && weapon.melee) return;
  if ((weapon.auto && trigger) || tapped || (weapon.melee && trigger)) {
    attackWith(world, player, inventory.current, player.aimAngle, weapon.melee ? null : inventory.ammo);
    if (!weapon.melee && (inventory.ammo[inventory.current] ?? 0) <= 0 && player.cooldown > 0.29) world.toast(`${weapon.name} is empty. Buy ammo at Brine & Barrel.`);
  }
}

/** Read the input and steer Dani, on foot or at the wheel. */
export function controlPlayer(world, input, dt) {
  const player = world.player;
  if (!player.alive || world.respawn) {
    player.moveX = 0;
    player.moveY = 0;
    if (player.vehicle) {
      player.vehicle.throttle = 0;
      player.vehicle.handbrake = true;
    }
    return;
  }
  const aim = screenToWorld(world.camera, input.mouse.x, input.mouse.y);
  const origin = player.vehicle ?? player;
  player.aimAngle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  player.enterLock = Math.max(0, (player.enterLock ?? 0) - dt);

  if (player.vehicle) {
    const vehicle = player.vehicle;
    vehicle.throttle = input.axis(KEYS.down, KEYS.up);
    vehicle.steer = input.axis(KEYS.left, KEYS.right);
    vehicle.handbrake = input.down('Space');
    if (input.pressed('KeyH')) {
      vehicle.hornTime = 0.45;
      world.audio.play('horn', vehicle.x, vehicle.y);
    }
    player.x = vehicle.x;
    player.y = vehicle.y;
    player.angle = vehicle.angle;
    useWeapon(world, input, player);
    if (input.pressed('KeyF', 'KeyE') && player.enterLock <= 0) {
      if (vehicleSpeed(vehicle) < 190) {
        exitVehicle(world);
        player.enterLock = 0.35;
      } else world.toast('Slow down to bail out.');
    }
    return;
  }

  let mx = input.axis(KEYS.left, KEYS.right);
  let my = input.axis(KEYS.up, KEYS.down);
  const length = Math.hypot(mx, my);
  const speed = input.down('ShiftLeft', 'ShiftRight') ? PLAYER_TUNING.sprint : PLAYER_TUNING.walk;
  if (length > 0) {
    mx = (mx / length) * speed;
    my = (my / length) * speed;
  }
  player.moveX = mx;
  player.moveY = my;
  player.angle = player.aimAngle;
  useWeapon(world, input, player);
  if (input.pressed('KeyF', 'KeyE') && player.enterLock <= 0) {
    const vehicle = nearestEnterable(world);
    if (vehicle) {
      enterVehicle(world, vehicle);
      player.enterLock = 0.35;
    }
  }
}
