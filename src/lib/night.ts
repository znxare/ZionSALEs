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

const CHOICE_KEY = 'zion-map-theme';

/**
 * Night level plus a day/night switch. Tapping the switch picks the opposite of what is showing and
 * keeps that for the visit; tapping back to what the clock would give returns to automatic.
 */
export function useNightControl(): { level: number; isNight: boolean; manual: boolean; toggle: () => void } {
  const auto = useNightLevel();
  const [choice, setChoice] = useState<'day' | 'night' | null>(() => {
    try { const v = sessionStorage.getItem(CHOICE_KEY); return v === 'day' || v === 'night' ? v : null; } catch { return null; }
  });
  const level = choice === 'night' ? 1 : choice === 'day' ? 0 : auto;
  const isNight = level > 0.5;
  const toggle = () => {
    const next: 'day' | 'night' = isNight ? 'day' : 'night';
    const clockSays = auto > 0.5 ? 'night' : 'day';
    const value = next === clockSays ? null : next;
    setChoice(value);
    try { if (value) sessionStorage.setItem(CHOICE_KEY, value); else sessionStorage.removeItem(CHOICE_KEY); } catch { /* no storage */ }
  };
  return { level, isNight, manual: choice !== null, toggle };
}
