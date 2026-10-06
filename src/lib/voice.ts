// Spoken warnings (the phone's own text-to-speech). Used only for hazards - deep water, and
// anything like it added later - never for ordinary directions, so there is no mute switch.

export function voiceAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
}

/** Say a warning now (cutting off anything still being said). */
export function speak(text: string) {
  if (!voiceAvailable()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    u.rate = 0.95;
    u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* not supported */ }
}
