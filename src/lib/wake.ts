import { useEffect } from 'react';

// Keeps the phone's screen awake while the public map is open (so the map doesn't go dark while you read it or
// follow directions). The browser lets go of the lock when the page is hidden, so it is taken again on return.

type Lock = { release: () => Promise<void>; addEventListener?: (t: 'release', f: () => void) => void };

export function useKeepAwake() {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } };
    if (!nav.wakeLock) return;
    let lock: Lock | null = null;
    let alive = true;
    const acquire = async () => {
      if (lock || !alive || document.visibilityState !== 'visible') return;
      try {
        const l = await nav.wakeLock!.request('screen');
        if (!alive) { void l.release(); return; }
        lock = l;
        l.addEventListener?.('release', () => { lock = null; });
      } catch { /* refused (battery saver, or no tap yet); tried again on the next tap */ }
    };
    void acquire();
    const again = () => { void acquire(); };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('pointerdown', again);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', again);
      window.removeEventListener('pointerdown', again);
      void lock?.release();
    };
  }, []);
}
