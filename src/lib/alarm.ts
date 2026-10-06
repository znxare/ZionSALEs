// A warning sound (two-tone siren) made with the Web Audio API — no sound file needed.
// Browsers only allow sound after the person has touched the page once, so the audio is
// unlocked on the first tap anywhere (the map is always tapped before anyone is near water).

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  return ctx;
}

if (typeof window !== 'undefined') {
  const unlock = () => { void context()?.resume(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
}

/** Two rising/falling tones, about 1.4 seconds. */
export function playAlarm() {
  const c = context();
  if (!c) return;
  try {
    void c.resume();
    const t0 = c.currentTime + 0.02;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.connect(c.destination);
    for (let i = 0; i < 4; i++) {
      const osc = c.createOscillator();
      osc.type = 'square';
      const start = t0 + i * 0.35;
      osc.frequency.setValueAtTime(i % 2 === 0 ? 960 : 720, start);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + 0.3);
      gain.gain.setValueAtTime(0.35, start);
      gain.gain.setValueAtTime(0.0001, start + 0.3);
    }
  } catch { /* audio not available */ }
}
