import { useEffect, useState } from 'react';

// Spoken directions and cautions (the phone's own text-to-speech). On by default for a
// live position; the speaker button in the directions banner turns it off, and the choice
// is remembered on the device.

const KEY = 'zion-voice-guidance';
let enabled = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();
const listeners = new Set<() => void>();

export function setVoiceEnabled(on: boolean) {
  enabled = on;
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
  if (!on) stopSpeaking();
  listeners.forEach((l) => l());
}

export function useVoiceEnabled(): boolean {
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    const l = () => setOn(enabled);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return on;
}

export function voiceAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
}

/** Say something now (cutting off anything still being said). `urgent` cautions are never skipped by the caller. */
export function speak(text: string) {
  if (!enabled || !voiceAvailable()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* not supported */ }
}
