// Seedable random numbers. The city uses its own fixed-seed generator so Marazul Bay is the same
// on every visit; everything else draws from the shared generator, which a screenshot scene seeds.

/** A small fast generator (mulberry32): returns a function giving numbers in [0, 1). */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let shared = createRandom((Date.now() ^ 0x9e3779b9) >>> 0);

export function seedRandom(seed) {
  shared = createRandom(seed);
}

export function rand() {
  return shared();
}

export function randRange(low, high) {
  return low + shared() * (high - low);
}

/** A whole number from low to high, both included. */
export function randInt(low, high) {
  return low + Math.floor(shared() * (high - low + 1));
}

export function chance(probability) {
  return shared() < probability;
}

export function pick(list) {
  return list[Math.floor(shared() * list.length)];
}

/** A stable pseudo-random number in [0, 1) for a pair of whole numbers (used for per-tile detail). */
export function hash2(a, b) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
