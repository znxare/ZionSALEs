import { useEffect, useState } from 'react';

// What the public map's info card shows besides the vacant-plot adverts: the weather and air
// quality at the estate right now (Open-Meteo, a free service that needs no key), sun and UV,
// a few facts, and sponsor slots.

// The estate (from the GPS calibration ride).
const LAT = 13.05, LNG = 78.145;

/** Sponsors shown in the map's info card. Add { name, tagline } and optionally a logo URL. */
export interface Sponsor { name: string; tagline: string; logo?: string }
export const SPONSORS: Sponsor[] = [];

/** Fixed facts about the estate. */
export const ESTATE_FACTS: { title: string; text: string }[] = [
  { title: '250-acre golf county', text: 'An 18-hole golf course woven through lakes, greens and villas.' },
  { title: 'Lakes all around', text: 'Water bodies sit throughout the course — please keep clear of the edges.' },
  { title: 'Hospitality villas', text: 'Twelve villas for getaways and corporate stays, right on the course.' },
];

export interface Atmosphere {
  tempC: number;
  feelsC: number;
  humidity: number;
  uv: number;
  uvMax: number | null;
  cloud: number;
  code: number;
  isDay: boolean;
  windKmh: number;
  sunrise: Date | null;
  sunset: Date | null;
  elevationM: number | null;
  aqi: number | null;
  pm25: number | null;
}

const CACHE = 'zion-atmosphere';
const FRESH_MS = 15 * 60 * 1000;

async function load(): Promise<Atmosphere | null> {
  const f = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current=temperature_2m,apparent_temperature,relative_humidity_2m,uv_index,cloud_cover,weather_code,wind_speed_10m,is_day&daily=sunrise,sunset,uv_index_max&timezone=Asia%2FKolkata&forecast_days=1`;
  const a = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LNG}&current=us_aqi,pm2_5&timezone=Asia%2FKolkata`;
  const [w, q] = await Promise.all([
    fetch(f).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(a).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  if (!w?.current) return null;
  const c = w.current;
  // Open-Meteo times are estate-local ("2026-10-06T18:04"); read them as India time.
  const ist = (s?: string) => (s ? new Date(`${s}:00+05:30`) : null);
  return {
    tempC: c.temperature_2m, feelsC: c.apparent_temperature, humidity: c.relative_humidity_2m,
    uv: c.uv_index ?? 0, uvMax: w.daily?.uv_index_max?.[0] ?? null, cloud: c.cloud_cover, code: c.weather_code,
    isDay: c.is_day === 1, windKmh: c.wind_speed_10m,
    sunrise: ist(w.daily?.sunrise?.[0]), sunset: ist(w.daily?.sunset?.[0]),
    elevationM: typeof w.elevation === 'number' ? Math.round(w.elevation) : null,
    aqi: q?.current?.us_aqi ?? null, pm25: q?.current?.pm2_5 ?? null,
  };
}

export function useAtmosphere(): Atmosphere | null {
  const [data, setData] = useState<Atmosphere | null>(null);
  useEffect(() => {
    let alive = true;
    try {
      const raw = sessionStorage.getItem(CACHE);
      if (raw) {
        const { t, v } = JSON.parse(raw);
        if (Date.now() - t < FRESH_MS) {
          setData({ ...v, sunrise: v.sunrise ? new Date(v.sunrise) : null, sunset: v.sunset ? new Date(v.sunset) : null });
          return;
        }
      }
    } catch { /* no storage */ }
    void load().then((v) => {
      if (!alive || !v) return;
      setData(v);
      try { sessionStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), v })); } catch { /* no storage */ }
    });
    return () => { alive = false; };
  }, []);
  return data;
}

/** How the air feels, in a word. */
export function feelsWord(feelsC: number): string {
  if (feelsC < 16) return 'Chilly';
  if (feelsC < 23) return 'Cool and fresh';
  if (feelsC < 29) return 'Pleasant';
  if (feelsC < 34) return 'Warm';
  return 'Hot';
}

export function skyWord(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? 'Clear skies' : 'Clear night';
  if (code <= 2) return isDay ? 'Partly cloudy' : 'Few clouds';
  if (code === 3) return 'Overcast';
  if (code >= 45 && code <= 48) return 'Misty';
  if (code >= 51 && code <= 67) return 'Rain';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Mixed weather';
}

/** US AQI bands. */
export function aqiWord(aqi: number): { word: string; tone: 'good' | 'ok' | 'bad' } {
  if (aqi <= 50) return { word: 'Good', tone: 'good' };
  if (aqi <= 100) return { word: 'Moderate', tone: 'ok' };
  if (aqi <= 150) return { word: 'Unhealthy for sensitive groups', tone: 'bad' };
  return { word: 'Unhealthy', tone: 'bad' };
}

export function uvWord(uv: number): { word: string; advice: string } {
  if (uv < 0.5) return { word: 'None', advice: 'No sun rays right now.' };
  if (uv < 3) return { word: 'Low', advice: 'Soft sun — comfortable outdoors.' };
  if (uv < 6) return { word: 'Moderate', advice: 'Wear a cap and some sunscreen.' };
  if (uv < 8) return { word: 'High', advice: 'Strong sun — sunscreen, cap and shade breaks.' };
  return { word: 'Very high', advice: 'Very strong sun — sunscreen, cap, and keep to shade at midday.' };
}

export function clockTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).replace(/\s/g, ' ').toLowerCase();
}
