// All sound is synthesised with the Web Audio API (no audio files): gunshots, crashes,
// explosions, horns, jingles, and the looping engine, tyre squeal, sirens and helicopter.
const MIN_GAP = 0.035;

/** A stand-in used before the first key press and in screenshot scenes: every call is silent. */
export function createSilentAudio() {
  return { context: null, master: null, play() {}, update() {}, unlock() {}, setListener() {} };
}

export function createAudio() {
  let context = null;
  let master = null;
  let noise = null;
  let loops = null;
  const lastPlayed = new Map();
  const listener = { x: 0, y: 0 };

  function makeNoise() {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let n = 0; n < data.length; n += 1) data[n] = Math.random() * 2 - 1;
    return buffer;
  }

  function envelope(volume, attack, length, destination = master) {
    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    gain.connect(destination);
    return gain;
  }

  function tone(type, from, to, length, volume, delay = 0) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + length);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + length + 0.03);
  }

  function burst(filterType, frequency, length, volume, sweepTo) {
    const source = context.createBufferSource();
    source.buffer = noise;
    source.playbackRate.value = 0.7 + Math.random() * 0.6;
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, context.currentTime);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, context.currentTime + length);
    source.connect(filter).connect(envelope(volume, 0.004, length));
    source.start(0, Math.random() * 0.5);
    source.stop(context.currentTime + length + 0.05);
  }

  const SOUNDS = {
    pistol: (v) => { burst('bandpass', 1700, 0.13, 0.55 * v); tone('sine', 170, 50, 0.1, 0.4 * v); },
    smg: (v) => { burst('bandpass', 2300, 0.07, 0.42 * v); tone('square', 210, 70, 0.05, 0.12 * v); },
    rifle: (v) => { burst('bandpass', 1300, 0.12, 0.5 * v); tone('sine', 140, 45, 0.11, 0.45 * v); },
    shotgun: (v) => { burst('lowpass', 2600, 0.32, 0.8 * v, 300); tone('sine', 120, 38, 0.2, 0.6 * v); },
    click: (v) => tone('square', 1500, 900, 0.03, 0.12 * v),
    swing: (v) => burst('bandpass', 700, 0.14, 0.2 * v, 1800),
    punch: (v) => { tone('sine', 150, 55, 0.11, 0.6 * v); burst('lowpass', 900, 0.07, 0.3 * v); },
    thud: (v) => { tone('sine', 110, 40, 0.16, 0.7 * v); burst('lowpass', 500, 0.1, 0.3 * v); },
    grunt: (v) => tone('sawtooth', 190 + Math.random() * 60, 110, 0.13, 0.11 * v),
    crash: (v) => { burst('lowpass', 3200, 0.3, 0.6 * v, 400); tone('square', 320, 90, 0.16, 0.14 * v); },
    explosion: (v) => { burst('lowpass', 1800, 1.3, 1.1 * v, 60); tone('sine', 95, 26, 0.9, 0.9 * v); },
    horn: (v) => { tone('square', 392, 392, 0.4, 0.1 * v); tone('square', 494, 494, 0.4, 0.1 * v); },
    door: (v) => { tone('sine', 190, 80, 0.07, 0.4 * v); burst('lowpass', 1200, 0.05, 0.18 * v); },
    spray: (v) => burst('highpass', 3500, 0.8, 0.22 * v),
    pickup: (v) => { tone('sine', 880, 880, 0.08, 0.2 * v); tone('sine', 1320, 1320, 0.14, 0.2 * v, 0.07); },
    buy: (v) => { tone('triangle', 1175, 1175, 0.09, 0.2 * v); tone('triangle', 1568, 1568, 0.25, 0.2 * v, 0.09); },
    conch: (v) => [523, 659, 784, 1047, 1319].forEach((f, n) => tone('triangle', f, f, 0.22, 0.2 * v, n * 0.08)),
    wanted: (v) => { tone('sawtooth', 620, 900, 0.16, 0.1 * v); tone('sawtooth', 900, 620, 0.2, 0.1 * v, 0.16); },
    missionStart: (v) => [392, 494, 587].forEach((f, n) => tone('triangle', f, f, 0.2, 0.2 * v, n * 0.11)),
    missionPassed: (v) => [523, 659, 784, 1047, 784, 1047].forEach((f, n) => tone('triangle', f, f, 0.26, 0.22 * v, n * 0.13)),
    missionFailed: (v) => [392, 370, 330, 262].forEach((f, n) => tone('sawtooth', f, f * 0.97, 0.34, 0.1 * v, n * 0.2)),
    wasted: (v) => { tone('sawtooth', 220, 55, 1.4, 0.16 * v); tone('sine', 110, 40, 1.4, 0.3 * v); },
    busted: (v) => [660, 520, 660, 520].forEach((f, n) => tone('square', f, f, 0.2, 0.08 * v, n * 0.2)),
  };

  function makeLoops() {
    const engine = context.createOscillator();
    const engineFilter = context.createBiquadFilter();
    const engineGain = context.createGain();
    engine.type = 'sawtooth';
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 500;
    engineGain.gain.value = 0;
    engine.connect(engineFilter).connect(engineGain).connect(master);
    engine.start();

    const looped = (filterType, frequency) => {
      const source = context.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(master);
      source.start();
      return gain;
    };
    const skid = looped('bandpass', 1900);
    const heli = looped('lowpass', 380);
    const chop = context.createOscillator();
    const chopDepth = context.createGain();
    chop.frequency.value = 13;
    chopDepth.gain.value = 0;
    chop.connect(chopDepth).connect(heli.gain);
    chop.start();

    const siren = context.createOscillator();
    const sirenGain = context.createGain();
    const wail = context.createOscillator();
    const wailDepth = context.createGain();
    siren.type = 'sawtooth';
    siren.frequency.value = 760;
    wail.frequency.value = 0.9;
    wailDepth.gain.value = 190;
    wail.connect(wailDepth).connect(siren.frequency);
    sirenGain.gain.value = 0;
    const sirenFilter = context.createBiquadFilter();
    sirenFilter.type = 'lowpass';
    sirenFilter.frequency.value = 1800;
    siren.connect(sirenFilter).connect(sirenGain).connect(master);
    siren.start();
    wail.start();
    return { engine, engineGain, engineFilter, skid, heli, chopDepth, sirenGain };
  }

  function ease(param, value) {
    param.setTargetAtTime(value, context.currentTime, 0.08);
  }

  const audio = {
    context: null,
    master: null,
    /** Start the audio engine; browsers only allow this after a key press or click. */
    unlock() {
      if (context) {
        if (context.state === 'suspended') context.resume();
        return;
      }
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = 0.55;
      const limiter = context.createDynamicsCompressor();
      master.connect(limiter).connect(context.destination);
      noise = makeNoise();
      loops = makeLoops();
      audio.context = context;
      audio.master = master;
    },
    setListener(x, y) {
      listener.x = x;
      listener.y = y;
    },
    /** Play a named sound; one given a position is quieter the further it is from the listener. */
    play(name, x, y) {
      if (!context || context.state !== 'running' || !SOUNDS[name]) return;
      let volume = 1;
      if (x !== undefined) {
        const distance = Math.hypot(x - listener.x, y - listener.y);
        volume = Math.max(0, 1 - distance / 900);
        volume *= volume;
        if (volume < 0.02) return;
      }
      const now = context.currentTime;
      if (now - (lastPlayed.get(name) ?? -1) < MIN_GAP) return;
      lastPlayed.set(name, now);
      SOUNDS[name](volume);
    },
    /** Keep the looping sounds in step with the world, or silence them when `world` is null. */
    update(world) {
      if (!context || !loops) return;
      const vehicle = world ? world.player.vehicle : null;
      if (vehicle) {
        const speed = Math.hypot(vehicle.vx, vehicle.vy);
        ease(loops.engine.frequency, 52 + speed * 0.33 + Math.abs(vehicle.throttle) * 18);
        ease(loops.engineFilter.frequency, 380 + speed * 2.4);
        ease(loops.engineGain.gain, 0.07 + Math.abs(vehicle.throttle) * 0.04);
        ease(loops.skid.gain, vehicle.skidding * 0.14);
      } else {
        ease(loops.engineGain.gain, 0);
        ease(loops.skid.gain, 0);
      }
      let siren = 0;
      if (world) {
        for (const other of world.vehicles) {
          if (!other.siren) continue;
          const distance = Math.hypot(other.x - listener.x, other.y - listener.y);
          siren = Math.max(siren, 1 - distance / 1100);
        }
      }
      ease(loops.sirenGain.gain, siren * siren * 0.075);
      const heli = world ? world.police.heli : null;
      const heliLevel = heli ? Math.max(0, 1 - Math.hypot(heli.x - listener.x, heli.y - listener.y) / 1200) : 0;
      ease(loops.heli.gain, heliLevel * 0.22);
      ease(loops.chopDepth.gain, heliLevel * 0.2);
    },
  };
  return audio;
}
