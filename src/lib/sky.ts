import type { Atmosphere } from './mapInfo';

// Small helpers for the sky, the weather and the "Today at Zion Hills" postcard.

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

/** How hard it is raining, 0..1, from the weather feed (?weather=rain on the link forces a shower). */
export function rainLevel(code: number | undefined): number {
  try {
    const m = /[?&]weather=(rain|clear)/.exec(window.location.hash + window.location.search);
    if (m) return m[1] === 'rain' ? 0.85 : 0;
  } catch { /* no window */ }
  if (code == null) return 0;
  if (code >= 95) return 1;
  if (code >= 80 && code <= 82) return 0.75;
  if (code >= 61 && code <= 67) return 0.65;
  if (code >= 51 && code <= 57) return 0.35;
  return 0;
}

/** The moon's age as a fraction of its cycle: 0 = new, 0.5 = full. */
export function moonCycle(now: Date = new Date()): number {
  const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  const SYNODIC = 29.530588853 * DAY_MS;
  return (((now.getTime() - NEW_MOON) % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
}

/**
 * Where the sun (by day) or the moon (by night) is along its arc, 0 = rising / setting on the left, 1 = on the right.
 * `night` is the map's current night level, so a manual day/night switch still shows a sensible body.
 */
export function bodyOnArc(now: Date, sunrise: Date | null, sunset: Date | null, night: number): { t: number; moon: boolean } {
  const moon = night > 0.5;
  const rise = sunrise?.getTime(), set = sunset?.getTime(), t = now.getTime();
  if (rise == null || set == null) return { t: 0.5, moon };
  const clockDay = t >= rise && t < set;
  if (!moon) return { t: clockDay ? Math.min(1, Math.max(0, (t - rise) / (set - rise))) : 0.5, moon };
  if (clockDay) return { t: 0.5, moon };
  const start = t >= set ? set : set - DAY_MS;
  const end = t >= set ? rise + DAY_MS : rise;
  return { t: Math.min(1, Math.max(0, (t - start) / (end - start))), moon };
}

export function clockText(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).replace(/\s/g, ' ').toLowerCase();
}

/** The one-line note on the postcard. */
export function postcardLine(a: Atmosphere | null, now: Date, rain: number): string {
  if (rain > 0.3) return 'Soft rain on the course. The greens glisten, and the clubhouse is never far.';
  const sunrise = a?.sunrise?.getTime(), sunset = a?.sunset?.getTime();
  const t = now.getTime();
  if (sunrise == null || sunset == null) return 'Golden hour is the best time on the 4th green.';
  const night = t < sunrise - 20 * MIN || t > sunset + 20 * MIN;
  if (night) return (a?.cloud ?? 0) < 50 ? 'A clear night. The roads are lamp-lit, and the lakes are closed after 6 PM.' : 'A cloudy night. The roads are lamp-lit, and the lakes are closed after 6 PM.';
  if (t < sunrise + 75 * MIN) return 'Mist on the lakes, and peacocks on the 4th green at first light.';
  const golden = sunset - 60 * MIN;
  if (t >= golden) return 'Golden hour right now. The best views are from hole 4.';
  return `Golden hour at ${clockText(new Date(golden))}. The best views are from hole 4.`;
}
