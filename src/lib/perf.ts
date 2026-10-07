// Keeps the map smooth on modest phones: when the device looks short of power (few cores, little memory, data
// saver on, or "reduce motion" switched on) the purely decorative moving extras are left out, and the map itself
// stays exactly as it is. Add ?lite=1 to a link to try it, ?lite=0 to force the full show.

let cached: boolean | null = null;

export function liteMode(): boolean {
  if (cached != null) return cached;
  let lite = false;
  try {
    const forced = /[?&]lite=(\d)/.exec(window.location.hash + window.location.search);
    if (forced) { cached = forced[1] === '1'; return cached; }
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    lite = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 3 || !!nav.connection?.saveData
      || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch { /* assume capable */ }
  cached = lite;
  return lite;
}
