import { useEffect, useState } from 'react';

// Lightweight module-level store (no context/provider needed for a single flag) —
// toggling it anywhere updates every subscribed component immediately, and it's
// remembered across reloads via localStorage since it's a per-device UI preference,
// not app data.
const STORAGE_KEY = 'zion-crm-presentation-mode';
const listeners = new Set<(on: boolean) => void>();

let current = false;
try {
  current = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1';
} catch {
  current = false;
}

export function getPresentationMode(): boolean {
  return current;
}

export function setPresentationMode(on: boolean): void {
  current = on;
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch {}
  listeners.forEach((l) => l(on));
}

/** True while Presentation Mode is on — subscribe from any component to blur sensitive fields for screenshots. */
export function usePresentationMode(): boolean {
  const [on, setOn] = useState(current);
  useEffect(() => {
    listeners.add(setOn);
    return () => { listeners.delete(setOn); };
  }, []);
  return on;
}
