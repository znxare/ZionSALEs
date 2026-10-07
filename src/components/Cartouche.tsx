import { useEffect, useState, type CSSProperties } from 'react';
import { feelsWord, skyWord, aqiWord, type Atmosphere } from '@/lib/mapInfo';
import { clockText, postcardLine, rainLevel } from '@/lib/sky';
import { lxEyebrow } from '@/lib/luxury';

// A "Today at Zion Hills" postcard "pinned" on the blank paper in the north-west: today's weather and one line
// about the day. It is part of the map, so it grows as you zoom in, and stays upright when the map turns.

type Pt = [number, number];

const POSTCARD_AT: Pt = [9.8, 3.6]; // top-left corner, % of the plan
const POSTCARD_W = 18;              // width, % of the plan

export function Postcard({ toScreen, zoom, layerWidth, upright, atmosphere, night }: {
  toScreen: (p: Pt) => number[];
  zoom: number;
  /** Width of the un-zoomed plan layer, in pixels. */
  layerWidth: number;
  upright?: CSSProperties;
  atmosphere: Atmosphere | null;
  night: number;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60 * 1000); return () => window.clearInterval(t); }, []);

  const pxPerPct = (zoom * layerWidth) / 100;
  const kP = (POSTCARD_W * pxPerPct) / 300;
  if (zoom < 1.05 || kP < 0.42) return null;

  const [px, py] = toScreen(POSTCARD_AT);
  const rain = rainLevel(atmosphere?.code);
  const A = atmosphere;
  const setTime = A?.sunset ? clockText(A.sunset) : null;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 12, opacity: 1 - 0.22 * night, transition: 'opacity 3s ease' }}>
      <div className="absolute" style={{ left: px, top: py, ...upright, transformOrigin: '0 0' }}>
        <div style={{ width: 300, transform: `scale(${kP}) rotate(-2.2deg)`, transformOrigin: '0 0' }} className="relative">
          <span className="absolute -top-2 left-6 h-4 w-14 -rotate-6 bg-[#e3c98d]/[0.7]" />
          <span className="absolute -top-2 right-10 h-4 w-12 rotate-3 bg-[#e3c98d]/[0.7]" />
          <div className="relative rounded-[3px] bg-gradient-to-br from-[#fffaf0] to-[#f2e8cf] px-4 pb-3 pt-3.5 shadow-[0_18px_34px_-14px_rgba(60,40,10,0.6)] ring-1 ring-[#d9c79b]">
            <div className="absolute right-3 top-3 grid h-11 w-11 rotate-6 place-items-center rounded-[3px] border-2 border-dashed border-[#b8924f] text-center font-serif text-[10px] font-semibold leading-tight text-[#9a6b2a]">Zion<br />Hills</div>
            <div className={`${lxEyebrow} text-[#7a6830]`}>Today at</div>
            <div className="font-serif text-[27px] font-semibold italic leading-none text-[#13261c]">Zion Hills</div>
            <div className="mt-2 flex items-end gap-3">
              <div className="font-serif text-[52px] font-semibold leading-[0.85] text-[#13261c]">{A ? `${Math.round(A.tempC)}°` : '—'}</div>
              <div className="pb-0.5 text-[12px] leading-tight text-[#5b5a4c]">
                {A ? <><b className="text-[#13261c]">{rain > 0.3 ? 'Raining' : skyWord(A.code, A.isDay)}</b><br />{feelsWord(A.feelsC)}, feels {Math.round(A.feelsC)}&deg;</> : 'Weather loading'}
              </div>
            </div>
            {A && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-[#5b5a4c]">
                {A.aqi != null && <span>Air {Math.round(A.aqi)} &middot; {aqiWord(A.aqi).word}</span>}
                {A.isDay && <span>UV {A.uv.toFixed(1)}</span>}
                {setTime && <span>Sunset {setTime}</span>}
              </div>
            )}
            <div className="mt-2 border-t border-dashed border-[#c9a96e] pt-2 font-serif text-[15px] italic leading-snug text-[#3a3a2c]">{postcardLine(A, now, rain)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
