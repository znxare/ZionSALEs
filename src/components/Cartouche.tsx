import { useEffect, useState, type CSSProperties } from 'react';
import { feelsWord, skyWord, aqiWord, type Atmosphere } from '@/lib/mapInfo';
import { bodyOnArc, clockText, postcardLine, rainLevel } from '@/lib/sky';
import { lxEyebrow } from '@/lib/luxury';

// Two things "printed" on the blank paper: a gold-framed cartouche (title, north rose, scale bar, sun times)
// in the east, and a "Today at Zion Hills" postcard in the north-west. They are part of the map, so they
// grow as you zoom in, and stay upright when the map turns.

type Pt = [number, number];

const CARTOUCHE_AT: Pt = [73.5, 31.0]; // top-left corner, % of the plan
const CARTOUCHE_W = 20;                // width, % of the plan
const POSTCARD_AT: Pt = [9.8, 3.6];
const POSTCARD_W = 18;

const METRES_PER_PCT = 23.7; // plan width -> metres, from the GPS calibration

function Rose({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" className="overflow-visible">
      <circle r={44} fill="none" stroke="#b8924f" strokeWidth={1.2} />
      <circle r={37} fill="none" stroke="#c9a96e" strokeWidth={0.6} strokeDasharray="1 3.2" />
      {Array.from({ length: 16 }, (_, i) => (
        <line key={i} x1={0} y1={-44} x2={0} y2={i % 4 === 0 ? -37 : -40.5} stroke="#8a7a52" strokeWidth={i % 4 === 0 ? 1.4 : 0.8} transform={`rotate(${i * 22.5})`} />
      ))}
      <path d="M0 -36 L5 -5 L-5 -5 Z" fill="#d9480f" />
      <path d="M0 36 L5 5 L-5 5 Z" fill="#13261c" />
      <path d="M-36 0 L-5 -5 L-5 5 Z" fill="#13261c" opacity={0.85} />
      <path d="M36 0 L5 -5 L5 5 Z" fill="#13261c" opacity={0.85} />
      <path d="M0 -26 L9 -9 L26 0 L9 9 L0 26 L-9 9 L-26 0 L-9 -9 Z" fill="none" stroke="#b8924f" strokeWidth={0.8} transform="rotate(45) scale(0.72)" />
      <circle r={4} fill="#fbf7ee" stroke="#13261c" strokeWidth={1.4} />
      <text y={-47} x={0} textAnchor="middle" fontSize={15} fontWeight={800} fill="#d9480f" fontFamily="Cormorant Garamond, serif" transform="translate(0 -2)">N</text>
    </svg>
  );
}

function SunArc({ now, a, night }: { now: Date; a: Atmosphere | null; night: number }) {
  const { t, moon } = bodyOnArc(now, a?.sunrise ?? null, a?.sunset ?? null, night);
  const x = 8 + t * 144, y = 56 - Math.sin(Math.PI * t) * 44;
  return (
    <svg width={160} height={66} viewBox="0 0 160 66" className="overflow-visible">
      <line x1={0} y1={56} x2={160} y2={56} stroke="#c9a96e" strokeWidth={0.9} />
      <path d="M 8 56 Q 80 -32 152 56" fill="none" stroke="#b8924f" strokeWidth={1} strokeDasharray="1.5 4" />
      <circle cx={8} cy={56} r={2.4} fill="#c9a96e" /><circle cx={152} cy={56} r={2.4} fill="#c9a96e" />
      {moon ? (
        <g transform={`translate(${x} ${y})`}><circle r={6.5} fill="#f4ecd2" stroke="#b8924f" strokeWidth={0.8} /><circle cx={2.6} cy={-1} r={5.4} fill="#fbf7ee" /></g>
      ) : (
        <g transform={`translate(${x} ${y})`}><circle r={11} fill="#ffd978" opacity={0.28} /><circle r={6.2} fill="#f6b73c" stroke="#fff1c4" strokeWidth={1} /></g>
      )}
    </svg>
  );
}

function niceLength(maxMetres: number): number {
  for (const m of [1000, 500, 250, 200, 100, 50, 25, 10]) if (m <= maxMetres) return m;
  return 10;
}

export function Cartouche({ toScreen, zoom, layerWidth, upright, turned, atmosphere, night }: {
  toScreen: (p: Pt) => number[];
  zoom: number;
  /** Width of the un-zoomed plan layer, in pixels. */
  layerWidth: number;
  upright?: CSSProperties;
  /** How far the map is turned, in degrees (the rose turns with it so it always points to true north). */
  turned: number;
  atmosphere: Atmosphere | null;
  night: number;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60 * 1000); return () => window.clearInterval(t); }, []);

  const pxPerPct = (zoom * layerWidth) / 100;
  const kC = (CARTOUCHE_W * pxPerPct) / 330;
  const kP = (POSTCARD_W * pxPerPct) / 300;
  if (zoom < 1.05) return null;

  // a scale bar that comes out between 60 and 110 screen pixels
  const metresPerPx = METRES_PER_PCT / pxPerPct;
  const barMetres = niceLength(110 * metresPerPx);
  const barPx = barMetres / metresPerPx / kC;

  const [cx, cy] = toScreen(CARTOUCHE_AT);
  const [px, py] = toScreen(POSTCARD_AT);
  const rain = rainLevel(atmosphere?.code);
  const A = atmosphere;
  const times = A?.sunrise && A?.sunset ? { rise: clockText(A.sunrise), set: clockText(A.sunset) } : null;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 12, filter: night > 0.05 ? `brightness(${(1 - 0.38 * night).toFixed(2)})` : undefined, transition: 'filter 3s ease' }}>
      {kC >= 0.42 && (
        <div className="absolute" style={{ left: cx, top: cy, ...upright, transformOrigin: '0 0' }}>
          <div style={{ width: 330, transform: `scale(${kC})`, transformOrigin: '0 0' }} className="relative">
            <div className="rounded-[4px] bg-[#f8f0da]/[0.93] p-[5px] shadow-[0_16px_34px_-14px_rgba(60,40,10,0.55)] ring-[1.5px] ring-[#b8924f]">
              <div className="rounded-[2px] border border-[#c9a96e] px-5 pb-3 pt-3">
                <div className={`${lxEyebrow} text-center text-[#9a8450]`}>&mdash; Master Plan &mdash;</div>
                <div className="text-center font-serif text-[44px] font-semibold leading-[0.95] text-[#13261c]">Zion Hills</div>
                <div className="mt-0.5 text-center text-[11px] font-semibold uppercase tracking-[0.46em] text-[#d9480f]">Golf County</div>
                <div className="my-2 flex items-center gap-2"><span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#c9a96e]" /><span className="h-1.5 w-1.5 rotate-45 bg-[#c9a96e]" /><span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#c9a96e]" /></div>
                <div className="flex items-center justify-between gap-2">
                  <div style={{ transform: `rotate(${-turned}deg)` }}><Rose size={76} /></div>
                  <div className="text-center">
                    <SunArc now={now} a={A} night={night} />
                    {times && (
                      <div className="-mt-1 flex justify-between px-1 text-[10.5px] font-semibold text-[#5b5a4c]"><span>&#9728; {times.rise}</span><span>{times.set} &#9790;</span></div>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="relative h-[7px]" style={{ width: barPx }}>
                    <div className="absolute inset-x-0 top-[3px] h-px bg-[#13261c]" />
                    <div className="absolute bottom-0 left-0 top-0 w-px bg-[#13261c]" /><div className="absolute bottom-0 right-0 top-0 w-px bg-[#13261c]" /><div className="absolute bottom-0 left-1/2 top-[2px] w-px bg-[#13261c]" />
                  </div>
                  <span className="text-[10.5px] font-semibold tabular-nums text-[#13261c]">{barMetres >= 1000 ? `${barMetres / 1000} km` : `${barMetres} m`}</span>
                  <span className="ml-auto text-[10px] italic text-[#8a7a52]">north up</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {kP >= 0.42 && (
        <div className="absolute" style={{ left: px, top: py, ...upright, transformOrigin: '0 0' }}>
          <div style={{ width: 300, transform: `scale(${kP}) rotate(-2.2deg)`, transformOrigin: '0 0' }} className="relative">
            <span className="absolute -top-2 left-6 h-4 w-14 -rotate-6 bg-[#e3c98d]/[0.7]" />
            <span className="absolute -top-2 right-10 h-4 w-12 rotate-3 bg-[#e3c98d]/[0.7]" />
            <div className="relative rounded-[3px] bg-gradient-to-br from-[#fffaf0] to-[#f2e8cf] px-4 pb-3 pt-3.5 shadow-[0_18px_34px_-14px_rgba(60,40,10,0.6)] ring-1 ring-[#d9c79b]">
              <div className="absolute right-3 top-3 grid h-11 w-11 rotate-6 place-items-center rounded-[3px] border-2 border-dashed border-[#b8924f] text-center font-serif text-[10px] font-semibold leading-tight text-[#9a6b2a]">Zion<br />Hills</div>
              <div className={`${lxEyebrow} text-[#9a8450]`}>Today at</div>
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
                  {times && <span>Sunset {times.set}</span>}
                </div>
              )}
              <div className="mt-2 border-t border-dashed border-[#c9a96e] pt-2 font-serif text-[15px] italic leading-snug text-[#3a3a2c]">{postcardLine(A, now, rain)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
