// Text-to-speech "host voice" using the browser's built-in speechSynthesis.
// Zero dependencies, zero cost, works offline. Voice quality varies by device.

function synth() {
  return typeof window !== 'undefined' ? window.speechSynthesis : null;
}

let preferred = null;
function pickVoice() {
  const s = synth();
  const voices = s?.getVoices?.() || [];
  if (!voices.length) return null;
  // Prefer a natural-sounding English voice when available.
  const nice = voices.find((v) =>
    /Google US English|Samantha|Daniel|Aria|Jenny|Guy|Natural/i.test(v.name)
  );
  const en = voices.find((v) => (v.lang || '').toLowerCase().startsWith('en'));
  return nice || en || voices[0];
}

if (synth()) {
  // Voices load asynchronously on most browsers.
  try {
    synth().onvoiceschanged = () => {
      preferred = pickVoice();
    };
  } catch {
    /* ignore */
  }
  preferred = pickVoice();
}

export const narrator = {
  // Prime the engine inside a user gesture (needed on iOS for later auto-speak).
  warmup() {
    const s = synth();
    if (!s) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      s.speak(u);
    } catch {
      /* ignore */
    }
  },
  speak(text, { rate = 1, pitch = 1 } = {}) {
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
  },
  cancel() {
    try {
      synth()?.cancel();
    } catch {
      /* ignore */
    }
  },
  supported() {
    return Boolean(synth());
  },
};
