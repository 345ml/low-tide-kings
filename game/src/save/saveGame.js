// Saving and loading progress in the browser's localStorage: money, story progress, weapons and
// ammunition, found conch shells, statistics and the time of day.
import { SAVE_KEY } from '../core/config.js';

const SAVE_VERSION = 1;

export function readSave() {
  try {
    const text = window.localStorage.getItem(SAVE_KEY);
    if (!text) return null;
    const data = JSON.parse(text);
    return data && data.version === SAVE_VERSION ? data : null;
  } catch {
    return null;
  }
}

export function hasSave() {
  return readSave() !== null;
}

/** Write the world's progress. Returns false when storage is unavailable (private windows). */
export function writeSave(world) {
  const data = {
    version: SAVE_VERSION,
    money: world.money,
    progress: world.progress,
    owned: world.inventory.owned,
    ammo: world.inventory.ammo,
    current: world.inventory.current,
    armor: world.player.armor,
    conchs: world.stats.conchs,
    kills: world.stats.kills,
    fares: world.stats.fares,
    dayTime: world.dayTime,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Copy saved progress into a freshly made world (before its pickups are placed). */
export function applySave(world, data) {
  world.money = data.money ?? 0;
  world.progress = data.progress ?? 0;
  world.inventory.owned = { fists: true, ...data.owned };
  world.inventory.ammo = { ...data.ammo };
  world.inventory.current = data.current ?? 'fists';
  world.player.armor = data.armor ?? 0;
  world.stats.conchs = Array.isArray(data.conchs) ? data.conchs.slice() : [];
  world.stats.kills = data.kills ?? 0;
  world.stats.fares = data.fares ?? 0;
  world.stats.missions = world.progress;
  world.dayTime = data.dayTime ?? 9;
}

export function eraseSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to erase when storage is off.
  }
}
