import { useEffect, useMemo, useState } from 'react';
import { useAtmosphere } from './mapInfo';

// How the light feels at the estate right now, from the same sunrise / sunset the night mode uses:
//   golden  - the warm hour before sunset (and a gentler one just after sunrise)
//   mist    - a pale haze on the lakes around dawn
//   shimmer - sun sparkling on the water through the day (a little moonlight at night)
// Add ?light=golden, ?light=mist or ?light=day to the link to see one regardless of the clock.

export interface Daylight { golden: number; mist: number; shimmer: number }

const MIN = 60 * 1000;
const ramp = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

function forcedLight(): 'golden' | 'mist' | 'day' | null {
  try {
    const m = /[?&]light=(golden|mist|day)/.exec(window.location.hash + window.location.search);
    return m ? (m[1] as 'golden' | 'mist' | 'day') : null;
  } catch { return null; }
}

function istDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** `night` is the map's current night level (0 day … 1 night), so a manual day/night switch is respected. */
export function useDaylight(night: number): Daylight {
  const atmosphere = useAtmosphere();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(t);
  }, []);

  const forced = forcedLight();
  const day = istDay(now);
  const sunset = (atmosphere?.sunset ?? new Date(`${day}T18:15:00+05:30`)).getTime();
  const sunrise = (atmosphere?.sunrise ?? new Date(`${day}T06:15:00+05:30`)).getTime();
  const t = now.getTime();

  // the warm hour before sunset, fading out in the twenty minutes after it
  let golden = t < sunset ? ramp(t, sunset - 60 * MIN, sunset) : 1 - ramp(t, sunset, sunset + 25 * MIN);
  // a softer warm light just after sunrise
  if (t >= sunrise && t < sunrise + 50 * MIN) golden = Math.max(golden, 0.6 * (1 - ramp(t, sunrise, sunrise + 50 * MIN)));
  if (t < sunrise) golden = 0;
  if (t > sunset + 25 * MIN) golden = 0;

  // dawn mist: builds from half an hour before sunrise, peaks just after it, gone by mid-morning
  const mist = t < sunrise ? ramp(t, sunrise - 30 * MIN, sunrise + 10 * MIN)
    : 1 - ramp(t, sunrise + 10 * MIN, sunrise + 90 * MIN);

  // sparkle by day; at night a little moonlight on the water (the layer tints it silver)
  const sunUp = t > sunrise + 20 * MIN && t < sunset - 5 * MIN;
  const k = 1 - night;
  const shimmer = night > 0.5 ? 0.5 : sunUp || night < 0.5 ? 1 : 0.7;
  const r = (v: number) => Math.round(v * 50) / 50;
  const [g2, m2, s2] = forced === 'golden' ? [1, 0, 1] : forced === 'mist' ? [0, 1, 0.6] : forced === 'day' ? [0, 0, 1] : [r(golden * k), r(mist * k), shimmer];
  // rounded and memoised: a new object only when something visibly changes
  return useMemo(() => ({ golden: g2, mist: m2, shimmer: s2 }), [g2, m2, s2]);
}
