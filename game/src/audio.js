// Synthesised sound effects: no audio files, just WebAudio oscillators and filtered
// noise, created lazily on the first user gesture so the browser allows it.

export function createAudio() {
  let context = null;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      const length = Math.floor(context.sampleRate * 0.3);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    } catch {
      context = null;
    }
    return context;
  }

  function tone(frequency, duration, type, volume, slideTo) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    if (slideTo !== undefined) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }

  function noise(duration, volume, cutoff) {
    const ctx = ensure();
    if (ctx === null || muted || noiseBuffer === null) return;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration);
  }

  function arpeggio(notes, noteDuration, type, volume) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    notes.forEach((frequency, index) => {
      window.setTimeout(() => tone(frequency, noteDuration, type, volume), index * noteDuration * 1000);
    });
  }

  return {
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot(kind) {
      if (kind === 'cannon') tone(160, 0.18, 'triangle', 0.12, 60);
      else if (kind === 'arc') tone(880, 0.08, 'sawtooth', 0.05, 220);
      else if (kind === 'frost') tone(660, 0.12, 'sine', 0.06, 440);
      else tone(520, 0.07, 'square', 0.05, 300);
    },
    boom() {
      noise(0.25, 0.18, 900);
    },
    coin() {
      tone(990, 0.09, 'sine', 0.07);
      window.setTimeout(() => tone(1320, 0.12, 'sine', 0.07), 70);
    },
    leak() {
      tone(140, 0.3, 'sawtooth', 0.14, 55);
    },
    horn() {
      tone(220, 0.5, 'triangle', 0.1, 330);
      window.setTimeout(() => tone(330, 0.5, 'triangle', 0.08, 440), 120);
    },
    build() {
      tone(392, 0.1, 'triangle', 0.08);
      window.setTimeout(() => tone(523, 0.12, 'triangle', 0.08), 80);
    },
    win() {
      arpeggio([523, 659, 784, 1047], 0.16, 'triangle', 0.1);
    },
    lose() {
      arpeggio([392, 330, 262, 196], 0.22, 'sawtooth', 0.07);
    },
  };
}
