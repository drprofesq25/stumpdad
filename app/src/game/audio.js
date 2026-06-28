// Dependency-free sound engine using the Web Audio API.
// Lazily creates a single AudioContext (resumed on first user gesture).

let ctx = null;
let muted = false;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(v) {
  muted = v;
}
export function isMuted() {
  return muted;
}

function tone({ type = 'sine', from, to, dur = 0.3, vol = 0.25, when = 0 }) {
  const c = getCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// --- Ambient background music: gentle major-pentatonic arpeggio loop ---
let musicTimer = null;
let musicGain = null;
let musicOn = false;
let step = 0;

const SCALE = [261.63, 329.63, 392.0, 440.0, 523.25, 659.25]; // C major pentatonic-ish

function scheduleBar() {
  const c = getCtx();
  if (!c || !musicGain || muted) return;
  const now = c.currentTime;
  for (let i = 0; i < 4; i++) {
    const f = SCALE[(step + i * 2) % SCALE.length] * (i % 2 === 0 ? 1 : 0.5);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    osc.connect(g);
    g.connect(musicGain);
    const t = now + i * 0.45;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.start(t);
    osc.stop(t + 0.45);
  }
  step = (step + 1) % SCALE.length;
}

export const music = {
  isOn: () => musicOn,
  start() {
    const c = getCtx();
    if (!c || musicOn) return;
    musicGain = c.createGain();
    musicGain.gain.value = 0.06; // very subtle
    musicGain.connect(c.destination);
    musicOn = true;
    scheduleBar();
    musicTimer = setInterval(scheduleBar, 1800);
  },
  stop() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    musicOn = false;
    if (musicGain) {
      try {
        const c = getCtx();
        musicGain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
      } catch {
        /* ignore */
      }
      musicGain = null;
    }
  },
  toggle() {
    if (musicOn) this.stop();
    else this.start();
    return musicOn;
  },
};

export const sfx = {
  unlock() {
    // Call once on first tap so iOS allows audio later.
    getCtx();
  },
  tap() {
    tone({ type: 'sine', from: 420, to: 520, dur: 0.06, vol: 0.12 });
  },
  reveal() {
    tone({ type: 'triangle', from: 300, to: 600, dur: 0.18, vol: 0.18 });
  },
  correct() {
    tone({ type: 'sine', from: 523.25, to: 1046.5, dur: 0.45, vol: 0.28 });
    tone({ type: 'sine', from: 659.25, to: 1318.5, dur: 0.4, vol: 0.16, when: 0.06 });
  },
  wrong() {
    tone({ type: 'sawtooth', from: 160, to: 90, dur: 0.34, vol: 0.26 });
  },
  combo(level = 2) {
    const base = 500 + level * 90;
    tone({ type: 'square', from: base, to: base * 1.5, dur: 0.12, vol: 0.18 });
    tone({ type: 'square', from: base * 1.5, to: base * 2, dur: 0.12, vol: 0.16, when: 0.1 });
  },
  steal() {
    tone({ type: 'triangle', from: 700, to: 300, dur: 0.22, vol: 0.2 });
  },
  tick() {
    tone({ type: 'sine', from: 880, to: 880, dur: 0.04, vol: 0.08 });
  },
  victory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => tone({ type: 'triangle', from: n, to: n, dur: 0.22, vol: 0.24, when: i * 0.14 }));
    tone({ type: 'sine', from: 1046.5, to: 2093, dur: 0.5, vol: 0.2, when: 0.6 });
  },
};

// --- Play an mp3 clip (TTS) through the shared, already-unlocked AudioContext.
// Routing TTS through WebAudio (instead of <audio>) avoids iOS autoplay blocks. ---
let currentClip = null;
export async function playClipFromArrayBuffer(arrayBuffer) {
  const c = getCtx();
  if (!c) throw new Error('no audio context');
  if (c.state === 'suspended') await c.resume();
  const buf = await c.decodeAudioData(arrayBuffer.slice(0));
  stopClip();
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = 1;
  src.connect(g);
  g.connect(c.destination);
  currentClip = src;
  return new Promise((resolve) => {
    src.onended = () => {
      if (currentClip === src) currentClip = null;
      resolve();
    };
    src.start();
  });
}
export function stopClip() {
  if (currentClip) {
    try {
      currentClip.stop();
    } catch {
      /* ignore */
    }
    currentClip = null;
  }
}
