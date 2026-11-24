// Things lying around to be picked up: dropped cash, health and armour, ammunition, mission
// items and the sixteen golden conch shells hidden around the bay.
import { T, TILE, MAP_H, MAP_W, PLAYER_TUNING } from '../core/config.js';
import { dist, formatMoney } from '../core/mathUtil.js';
import { createRandom } from '../core/random.js';

export const CONCH_COUNT = 16;
const CONCH_REWARD = 250;

export function dropPickup(world, type, x, y, amount = 0, extra = null) {
  const pickup = { type, x, y, amount, age: 0, life: type === 'cash' || type === 'ammo' ? 45 : Infinity, respawn: 0, hidden: 0, tag: null, ...extra };
  world.pickups.push(pickup);
  return pickup;
}

/** Put the fixed pickups in the world: conch shells not yet found, and health and armour spots. */
export function placeWorldPickups(world) {
  const rng = createRandom(4242);
  const city = world.city;
  const shells = [];
  for (let attempt = 0; attempt < 6000 && shells.length < CONCH_COUNT; attempt += 1) {
    const tx = 8 + Math.floor(rng() * (MAP_W - 12));
    const ty = 8 + Math.floor(rng() * (MAP_H - 14));
    const tile = city.tiles[ty * MAP_W + tx];
    if (city.solid[ty * MAP_W + tx] !== 0 || (tile !== T.SAND && tile !== T.PLAZA && tile !== T.PIER && tile !== T.GRASS && tile !== T.LOT)) continue;
    const x = (tx + 0.5) * TILE;
    const y = (ty + 0.5) * TILE;
    if (shells.some((shell) => dist(shell.x, shell.y, x, y) < 900)) continue;
    shells.push({ x, y });
  }
  shells.forEach((shell, index) => {
    if (!world.stats.conchs.includes(index)) dropPickup(world, 'conch', shell.x, shell.y, CONCH_REWARD, { tag: index });
  });
  const places = city.places;
  dropPickup(world, 'health', places.hospital.x + 40, places.hospital.y, 60, { respawn: 50 });
  dropPickup(world, 'health', places.safehouse.x + 44, places.safehouse.y, 60, { respawn: 50 });
  dropPickup(world, 'health', places.pierNorth.x, places.pierNorth.y, 60, { respawn: 70 });
  dropPickup(world, 'health', places.boatyard.x + 70, places.boatyard.y, 60, { respawn: 50 });
  dropPickup(world, 'armor', places.pierSouth.x, places.pierSouth.y, 100, { respawn: 120 });
  dropPickup(world, 'armor', places.policeStation.x - 60, places.policeStation.y, 100, { respawn: 120 });
  dropPickup(world, 'armor', places.marina.x, places.marina.y - 20, 100, { respawn: 120 });
}

function collect(world, pickup) {
  const player = world.player;
  const inventory = world.inventory;
  if (pickup.type === 'cash') {
    world.addMoney(pickup.amount, pickup.x, pickup.y);
  } else if (pickup.type === 'health') {
    if (player.health >= PLAYER_TUNING.maxHealth) return false;
    player.health = Math.min(PLAYER_TUNING.maxHealth, player.health + pickup.amount);
    world.fx.text(pickup.x, pickup.y, '+HEALTH', '#7dff9b');
  } else if (pickup.type === 'armor') {
    if (player.armor >= PLAYER_TUNING.maxArmor) return false;
    player.armor = PLAYER_TUNING.maxArmor;
    world.fx.text(pickup.x, pickup.y, '+ARMOUR', '#7fd0ff');
  } else if (pickup.type === 'ammo') {
    const weapon = inventory.current !== 'fists' ? inventory.current : inventory.owned.pistol ? 'pistol' : null;
    if (!weapon) return false;
    inventory.ammo[weapon] = (inventory.ammo[weapon] ?? 0) + pickup.amount;
    world.fx.text(pickup.x, pickup.y, `+${pickup.amount} AMMO`, '#ffe08a');
  } else if (pickup.type === 'conch') {
    world.stats.conchs.push(pickup.tag);
    world.addMoney(pickup.amount, pickup.x, pickup.y);
    world.toast(`Golden conch ${world.stats.conchs.length}/${CONCH_COUNT} · ${formatMoney(pickup.amount)}`);
  }
  world.audio.play(pickup.type === 'conch' ? 'conch' : 'pickup');
  world.events.push({ type: 'pickup', pickup });
  return true;
}

export function stepPickups(world, dt) {
  const player = world.player;
  const px = world.focus.x;
  const py = world.focus.y;
  for (let index = world.pickups.length - 1; index >= 0; index -= 1) {
    const pickup = world.pickups[index];
    pickup.age += dt;
    if (pickup.hidden > 0) {
      pickup.hidden -= dt;
      continue;
    }
    if (pickup.age > pickup.life) {
      world.pickups.splice(index, 1);
      continue;
    }
    const reach = player.vehicle ? (pickup.type === 'item' || pickup.type === 'cash' ? 34 : 0) : 20;
    if (!player.alive || world.mode !== 'play' || dist(pickup.x, pickup.y, px, py) > reach) continue;
    if (!collect(world, pickup)) continue;
    if (pickup.respawn > 0) pickup.hidden = pickup.respawn;
    else world.pickups.splice(index, 1);
  }
}
