// Keeps the map smooth on modest phones: when the device looks short of power (few cores, little memory, data
// saver on, or "reduce motion" switched on) the purely decorative moving extras are left out, and the map itself
// stays exactly as it is. Add ?lite=1 to a link to try it, ?lite=0 to force the full show.

let cached: boolean | null = null;

/**
 * Many small decorative shapes (lake glints, stars, far-off lights) drawn as ONE picture instead of
 * hundreds of live SVG elements: the browser rasterises it once and a twinkle only fades the picture,
 * which the graphics chip does on its own. `body` is SVG markup in a 0..100 x 0..100 box.
 */
export function svgPicture(body: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${body}</svg>`)}`;
}

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
