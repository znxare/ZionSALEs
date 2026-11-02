import { AMENITIES } from '@/lib/directions';

// Names written on the map itself, instead of the numbered red markers and legend the master plan
// used to carry ("6" meant nothing until you found it in the legend). The two gates are always
// shown, large and in the brand orange; the other places appear as they fit.

type Landmark = {
  id: string;
  label: string;
  pt: [number, number];
  /** The gates: always shown, big, orange. */
  gate?: boolean;
  /** Smallest zoom at which the name is shown. */
  minZoom: number;
  /** Highest first: who gets the room when names would overlap. */
  rank: number;
};

const at = (id: string): [number, number] => AMENITIES.find((a) => a.id === id)!.pt;

const LANDMARKS: Landmark[] = [
  { id: 'gate-main', label: 'Main Entry', pt: at('entry-main'), gate: true, minZoom: 0, rank: 10 },
  { id: 'clubhouse', label: 'Restaurant', pt: at('clubhouse'), minZoom: 1.3, rank: 8 },
  { id: 'sports', label: 'Sports Courts', pt: at('sports'), minZoom: 1.6, rank: 6 },
  { id: 'practice', label: 'Golf Practice', pt: at('practice'), minZoom: 1.3, rank: 7 },
  { id: 'commercial', label: 'Commercial & Residential', pt: [14.89, 54.36], minZoom: 1.8, rank: 4 },
];

export type LandmarkShown = { landmark: Landmark; x: number; y: number };

type Claim = (x: number, y: number, w: number, h: number, force?: boolean) => boolean;

/** Which names fit on screen right now (gates first, then the rest by rank, skipping any that would overlap). */
export function pickLandmarks(toScreen: (p: [number, number]) => number[], zoom: number, claim: Claim): LandmarkShown[] {
  const out: LandmarkShown[] = [];
  for (const l of [...LANDMARKS].sort((a, b) => b.rank - a.rank)) {
    if (zoom < l.minZoom) continue;
    const [x, y] = toScreen(l.pt);
    const w = l.label.length * (l.gate ? 8 : 6.2) + 30;
    if (l.gate) { claim(x, y - 22, w, 34, true); out.push({ landmark: l, x, y }); continue; }
    if (claim(x, y, w, 22)) out.push({ landmark: l, x, y });
  }
  return out;
}

export function PlanLandmarks({ shown, upright }: { shown: LandmarkShown[]; upright?: React.CSSProperties }) {
  return (
    <>
      {shown.map(({ landmark: l, x, y }) => (
        <div key={l.id} className={`pointer-events-none absolute ${l.gate ? 'z-[25]' : 'z-20'}`} style={{ left: x, top: y, ...upright, transformOrigin: '0 0' }}>
          {l.gate ? (
            <div className="absolute flex -translate-x-1/2 -translate-y-[calc(100%-7px)] flex-col items-center">
              <span className={`flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#f05a22] py-[5px] pl-2 pr-3 font-bold tracking-wide text-white shadow-[0_3px_9px_-2px_rgba(38,35,31,0.55)] ring-2 ring-white ${l.id === 'gate-main' ? 'text-[13px]' : 'text-[12px]'}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21V9l9-6 9 6v12" /><path d="M9 21v-8h6v8" /></svg>
                {l.label}
              </span>
              <span className="h-2 w-[2px] bg-white" />
              <span className="relative grid h-3.5 w-3.5 place-items-center">
                <span className="zh-anim absolute inset-0 animate-ping rounded-full bg-[#f05a22]/60" />
                <span className="relative h-3 w-3 rounded-full bg-[#f05a22] ring-2 ring-white" />
              </span>
            </div>
          ) : (
            <div className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.94] py-[3px] pl-1.5 pr-2.5 text-[11px] font-semibold text-[#26231f] shadow-[0_1px_4px_rgba(38,35,31,0.35)]">
              <span className="h-2 w-2 rounded-full bg-[#3e5f3b] ring-1 ring-white" />
              {l.label}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
