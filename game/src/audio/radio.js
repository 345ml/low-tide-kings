// The car radio: three stations whose music is composed here as chord progressions, bass lines,
// melodies and drum patterns, and synthesised live by a small step sequencer.
const STATIONS = [
  {
    name: 'Brisa FM · neon coast synth',
    bpm: 104,
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]],
    bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
    lead: [0, -1, 2, -1, 3, -1, 2, 1, -1, 3, -1, 2, 0, -1, 1, -1],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    leadWave: 'sawtooth',
    padWave: 'sawtooth',
  },
  {
    name: 'Radio Coral · barrio heat',
    bpm: 96,
    chords: [[50, 53, 57, 60], [55, 58, 62, 65], [48, 52, 55, 58], [53, 57, 60, 64]],
    bass: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    lead: [2, -1, -1, 3, -1, 2, -1, 1, 0, -1, -1, 1, -1, 2, -1, -1],
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0],
    leadWave: 'square',
    padWave: 'triangle',
  },
  {
    name: 'Low Tide Lo-Fi · slack water',
    bpm: 78,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    bass: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    lead: [-1, 3, -1, -1, 2, -1, -1, 1, -1, -1, 0, -1, 2, -1, -1, -1],
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    leadWave: 'triangle',
    padWave: 'sine',
  },
];

function hertz(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

export function createRadio(audio) {
  let station = 0;
  let output = null;
  let step = 0;
  let nextTime = 0;
  let playing = false;
  let noise = null;

  function voice(type, frequency, start, length, volume, cutoff) {
    const context = audio.context;
    const osc = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(filter).connect(gain).connect(output);
    osc.start(start);
    osc.stop(start + length + 0.05);
  }

  function drum(kind, start) {
    const context = audio.context;
    if (kind === 'kick') {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.frequency.setValueAtTime(150, start);
      osc.frequency.exponentialRampToValueAtTime(42, start + 0.13);
      gain.gain.setValueAtTime(0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(output);
      osc.start(start);
      osc.stop(start + 0.2);
      return;
    }
    if (!noise) {
      noise = context.createBuffer(1, context.sampleRate / 2, context.sampleRate);
      const data = noise.getChannelData(0);
      for (let n = 0; n < data.length; n += 1) data[n] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = kind === 'snare' ? 'bandpass' : 'highpass';
    filter.frequency.value = kind === 'snare' ? 1900 : 7000;
    const gain = context.createGain();
    const length = kind === 'snare' ? 0.14 : 0.04;
    gain.gain.setValueAtTime(kind === 'snare' ? 0.26 : 0.1, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter).connect(gain).connect(output);
    source.start(start);
    source.stop(start + length + 0.02);
  }

  function schedule(def, index, time, sixteenth) {
    const bar = Math.floor(index / 16) % def.chords.length;
    const chord = def.chords[bar];
    const beat = index % 16;
    if (beat === 0) for (const note of chord) voice(def.padWave, hertz(note), time, sixteenth * 15, 0.035, 1100);
    if (def.bass[beat]) voice('triangle', hertz(chord[0] - 12), time, sixteenth * 2.4, 0.2, 500);
    const tone = def.lead[beat];
    if (tone >= 0 && Math.floor(index / 32) % 2 === 1) voice(def.leadWave, hertz(chord[tone] + 12), time, sixteenth * 2.6, 0.05, 2300);
    if (def.kick[beat]) drum('kick', time);
    if (def.snare[beat]) drum('snare', time);
    if (def.hat[beat]) drum('hat', time);
  }

  return {
    /** The station names, for the HUD; -1 is the radio switched off. */
    stationName() {
      return station < 0 ? 'Radio off' : STATIONS[station].name;
    },
    next() {
      station = station + 1 >= STATIONS.length ? -1 : station + 1;
      step = 0;
      nextTime = 0;
      return this.stationName();
    },
    /** Call every frame: the radio plays while `on` is true (the player is in a vehicle). */
    update(on) {
      const context = audio.context;
      if (!context || context.state !== 'running') return;
      if (!output) {
        output = context.createGain();
        output.gain.value = 0;
        output.connect(audio.master);
      }
      const wanted = on && station >= 0;
      if (wanted !== playing) {
        playing = wanted;
        output.gain.setTargetAtTime(wanted ? 0.5 : 0, context.currentTime, 0.25);
        if (wanted) nextTime = context.currentTime + 0.05;
      }
      if (!playing) return;
      const def = STATIONS[station];
      const sixteenth = 60 / def.bpm / 4;
      if (nextTime < context.currentTime - 0.3) nextTime = context.currentTime + 0.05;
      while (nextTime < context.currentTime + 0.14) {
        schedule(def, step, nextTime, sixteenth);
        step += 1;
        nextTime += sixteenth;
      }
    },
  };
}
