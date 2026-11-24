// The places that do something for the player: the Casa Coral safehouse (rest and save), the
// Brine & Barrel gun shop, FreshCoat Auto (respray, repair, lose the police), St. Brisa Medical,
// and where Dani wakes up after being taken out or arrested.
import { PLAYER_TUNING } from '../core/config.js';
import { dist, formatMoney } from '../core/mathUtil.js';
import { pick } from '../core/random.js';
import { vehicleSpeed } from '../entities/vehicle.js';
import { WEAPONS } from '../combat/weapons.js';
import { clearWanted } from '../police/wantedSystem.js';

export const SERVICES = [
  { key: 'safehouse', name: 'Casa Coral', icon: 'S', color: '#7dff9b' },
  { key: 'gunShop', name: 'Brine & Barrel', icon: 'G', color: '#ff8fab' },
  { key: 'paintShop', name: 'FreshCoat Auto', icon: 'P', color: '#4cc9f0' },
  { key: 'hospital', name: 'St. Brisa Medical', icon: '+', color: '#ffffff' },
];

export const SHOP_ITEMS = [
  { weapon: 'pistol' },
  { weapon: 'smg' },
  { weapon: 'shotgun' },
  { weapon: 'rifle' },
  { armor: true, name: 'Body armour', price: 400 },
];

const PAINT_PRICE = 200;
const HEAL_PRICE = 100;
const RESPRAY_COLORS = ['#2ec4b6', '#9d4edd', '#ff7b54', '#8ac926', '#3a86ff', '#ff99c8', '#f7f7f2', '#2b2d42'];

/** What a shop line costs right now: the gun if not owned yet, else a cheaper ammo refill. */
export function shopPrice(world, item) {
  if (item.armor) return item.price;
  const weapon = WEAPONS[item.weapon];
  return world.inventory.owned[item.weapon] ? Math.round(weapon.price * 0.3) : weapon.price;
}

export function buyShopItem(world, item) {
  const price = shopPrice(world, item);
  if (world.money < price) {
    world.toast('Not enough cash.');
    world.audio.play('click');
    return false;
  }
  if (item.armor) {
    if (world.player.armor >= PLAYER_TUNING.maxArmor) return false;
    world.player.armor = PLAYER_TUNING.maxArmor;
  } else {
    const weapon = WEAPONS[item.weapon];
    world.inventory.owned[item.weapon] = true;
    world.inventory.ammo[item.weapon] = (world.inventory.ammo[item.weapon] ?? 0) + weapon.pack;
    world.inventory.current = item.weapon;
  }
  world.money -= price;
  world.audio.play('buy');
  return true;
}

export function stepServices(world, input, dt) {
  const player = world.player;
  const places = world.city.places;
  world.paintCooldown = Math.max(0, (world.paintCooldown ?? 0) - dt);
  for (const service of SERVICES) {
    const spot = places[service.key];
    world.markers.push({ x: spot.x, y: spot.y, kind: 'service', label: service.icon, color: service.color, radius: 34, title: service.name });
  }
  if (world.mode !== 'play' || world.respawn || !player.alive) return;
  const enter = input.pressed('Enter');
  const near = (key, range) => dist(world.focus.x, world.focus.y, places[key].x, places[key].y) < range;

  if (!player.vehicle && near('safehouse', 38)) {
    world.prompt = world.mission || world.wanted.stars > 0 ? 'Casa Coral: finish your business before resting' : 'ENTER  rest and save at Casa Coral';
    if (enter && !world.mission && world.wanted.stars === 0) {
      player.health = PLAYER_TUNING.maxHealth;
      world.dayTime = (world.dayTime + 6) % 24;
      world.saveRequested = true;
      world.toast('Rested. Game saved.');
      world.audio.play('buy');
    }
  } else if (!player.vehicle && near('gunShop', 38)) {
    world.prompt = 'ENTER  shop at Brine & Barrel';
    if (enter) world.shop = { index: 0 };
  } else if (!player.vehicle && near('hospital', 38) && player.health < PLAYER_TUNING.maxHealth) {
    world.prompt = `ENTER  patch up for ${formatMoney(HEAL_PRICE)}`;
    if (enter && world.money >= HEAL_PRICE) {
      world.money -= HEAL_PRICE;
      player.health = PLAYER_TUNING.maxHealth;
      world.audio.play('buy');
    }
  } else if (player.vehicle && near('paintShop', 48) && !(world.mission && world.mission.vehicle === player.vehicle)) {
    const vehicle = player.vehicle;
    world.prompt = `FreshCoat Auto: stop here for a respray (${formatMoney(PAINT_PRICE)})`;
    if (vehicleSpeed(vehicle) < 30 && world.paintCooldown <= 0) {
      world.paintCooldown = 6;
      if (vehicle.police) world.toast('FreshCoat does not touch police cars.');
      else if (world.money < PAINT_PRICE) world.toast(`A respray costs ${formatMoney(PAINT_PRICE)}.`);
      else {
        world.money -= PAINT_PRICE;
        vehicle.color = pick(RESPRAY_COLORS.filter((color) => color !== vehicle.color));
        vehicle.health = vehicle.kind.health;
        vehicle.burning = 0;
        const hadHeat = world.wanted.stars > 0;
        clearWanted(world);
        world.fx.text(vehicle.x, vehicle.y - 20, 'FRESH COAT', '#4cc9f0');
        world.toast(hadHeat ? 'New paint, clean record. The police lost you.' : 'Resprayed and repaired.');
        world.audio.play('spray');
      }
    }
  }
}

/** Put Dani back on her feet after being taken out ('wasted') or arrested ('busted'). */
export function respawnPlayer(world, kind) {
  const player = world.player;
  const spot = kind === 'busted' ? world.city.places.policeStation : world.city.places.hospital;
  if (player.vehicle) {
    player.vehicle.driver = null;
    player.vehicle.throttle = 0;
    player.vehicle = null;
  }
  player.x = spot.x;
  player.y = spot.y;
  player.alive = true;
  player.health = PLAYER_TUNING.maxHealth;
  player.armor = 0;
  player.knockX = 0;
  player.knockY = 0;
  const cost = Math.min(kind === 'busted' ? 800 : 500, Math.round(world.money * 0.12));
  world.money -= cost;
  if (kind === 'busted') for (const key of Object.keys(world.inventory.ammo)) world.inventory.ammo[key] = Math.floor(world.inventory.ammo[key] / 2);
  clearWanted(world);
  world.police.heli = null;
  world.police.bust = 0;
  for (const vehicle of world.vehicles) if (vehicle.police && vehicle.ai) vehicle.remove = true;
  for (const person of world.people) if (person.role === 'cop') person.remove = true;
  world.dayTime = (world.dayTime + 3) % 24;
  world.toast(kind === 'busted' ? `Bailed out. The MBPD kept ${formatMoney(cost)} and half your ammo.` : `Patched up at St. Brisa for ${formatMoney(cost)}.`);
}
