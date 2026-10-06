import { useEffect, useState } from 'react';
import { useAtmosphere } from './mapInfo';

// Night mode for the map: from sunset it darkens over about 35 minutes, and it lightens again
// towards sunrise. Sunset and sunrise come from the live weather feed, or 6:15 pm / 6:15 am
// (estate time) if that can't be reached. Add ?night=1 (or ?night=0) to the link to force it.

const RAMP_MS = 35 * 60 * 1000;

function istDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function forced(): number | null {
  try {
    const m = /[?&]night=(\d)/.exec(window.location.hash + window.location.search);
    return m ? (m[1] === '1' ? 1 : 0) : null;
  } catch { return null; }
}

/** 0 = full daylight, 1 = full night. */
export function useNightLevel(): number {
  const atmosphere = useAtmosphere();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(t);
  }, []);

  const f = forced();
  if (f != null) return f;
  const day = istDate(now);
  const sunset = atmosphere?.sunset ?? new Date(`${day}T18:15:00+05:30`);
  const sunrise = atmosphere?.sunrise ?? new Date(`${day}T06:15:00+05:30`);
  const t = now.getTime();
  if (t < sunrise.getTime()) return Math.min(1, (sunrise.getTime() - t) / RAMP_MS);
  if (t >= sunset.getTime()) return Math.min(1, (t - sunset.getTime()) / RAMP_MS);
  return 0;
}
