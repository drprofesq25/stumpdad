// Host voice. Prefers premium cloud TTS (OpenAI via /api/tts) for a charismatic
// game-show announcer; falls back to the browser's built-in speechSynthesis if
// the server has no TTS key or a call fails.
import { playClipFromArrayBuffer, stopClip } from './audio.js';

function synth() {
  return typeof window !== 'undefined' ? window.speechSynthesis : null;
}

let cloudAvailable = false;
let preferred = null;

function pickVoice() {
  const s = synth();
  const voices = s?.getVoices?.() || [];
  if (!voices.length) return null;
  const nice = voices.find((v) => /Google US English|Samantha|Daniel|Aria|Jenny|Guy|Natural/i.test(v.name));
  const en = voices.find((v) => (v.lang || '').toLowerCase().startsWith('en'));
  return nice || en || voices[0];
}

if (synth()) {
  try {
    synth().onvoiceschanged = () => {
      preferred = pickVoice();
    };
  } catch {
    /* ignore */
  }
  preferred = pickVoice();
}

function speakBrowser(text, { rate = 1, pitch = 1 } = {}) {
  const s = synth();
  if (!s || !text) return;
  try {
    s.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    if (!preferred) preferred = pickVoice();
    if (preferred) u.voice = preferred;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = 1;
    s.speak(u);
  } catch {
    /* ignore */
  }
}

async function speakCloud(text) {
  const resp = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) throw new Error('tts http ' + resp.status);
  const buf = await resp.arrayBuffer();
  await playClipFromArrayBuffer(buf);
}

export const narrator = {
  // Ask the server whether premium TTS is configured.
  async init() {
    try {
      const r = await fetch('/api/health');
      const j = await r.json();
      cloudAvailable = Boolean(j.tts);
    } catch {
      cloudAvailable = false;
    }
    return cloudAvailable;
  },
  usingCloud() {
    return cloudAvailable;
  },
  // Prime engines inside a user gesture (helps iOS allow later auto-speak).
  warmup() {
    const s = synth();
    if (s) {
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        s.speak(u);
        s.cancel();
      } catch {
        /* ignore */
      }
    }
  },
  speak(text) {
    if (!text) return;
    this.cancel();
    if (cloudAvailable) {
      speakCloud(text).catch(() => speakBrowser(text));
    } else {
      speakBrowser(text);
    }
  },
  // Warm the server cache for an upcoming line so playback is instant.
  prefetch(text) {
    if (!text || !cloudAvailable) return;
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => {});
  },
  cancel() {
    stopClip();
    try {
      synth()?.cancel();
    } catch {
      /* ignore */
    }
  },
  supported() {
    return cloudAvailable || Boolean(synth());
  },
};
