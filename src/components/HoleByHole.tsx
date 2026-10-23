import { useEffect, useMemo } from 'react';
import { HoleCard } from './HoleCard';
import { HOLE_GUIDE, holeGuide } from '@/lib/holes';
import { holeMid, useNearHole } from '@/lib/holeNear';
import { lxIvory } from '@/lib/luxury';
import type { HolePin, HoleTrail, MapFocus } from './LiveInventoryBoard';
import type { MapPt } from '@/lib/tour';

// The public map's "Hole by hole" layer, as its own download: the hole badges and line, the
// "You're on Hole N" strip and the hole card. Loaded only once the visitor switches it on.

export interface HoleReport { pins: HolePin[]; trail: HoleTrail | null; showing: boolean }

export default function HoleByHole({ markerPt, idle, holeSel, onSelect, onClose, onReport, onFocus, onTeeOff, frameSignal }: {
  /** The visitor's position on the plan (null when unknown or off the estate). */
  markerPt: MapPt | null;
  /** True while no directions are being previewed or followed. */
  idle: boolean;
  holeSel: number | null;
  onSelect: (n: number) => void;
  onClose: () => void;
  onReport: (r: HoleReport) => void;
  onFocus: (f: MapFocus) => void;
  onTeeOff: (n: number) => void;
  /** Changes whenever the selected hole should be framed on the map again. */
  frameSignal: number;
}) {
  const near = useNearHole(markerPt);
  const activeHole = holeSel ?? (near ? near.hole.n : null);

  const pins = useMemo<HolePin[]>(
    () => (!idle ? [] : HOLE_GUIDE.filter((h) => !near || h.n === near.hole.n || h.n === holeSel).map((h) => ({ n: h.n, pt: holeMid(h.n) }))),
    [idle, near?.hole.n, holeSel], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const trail = useMemo<HoleTrail | null>(() => {
    const g = activeHole != null && idle ? holeGuide(activeHole) : null;
    return g ? { n: g.n, tee: g.tee, mid: holeMid(g.n), green: g.green } : null;
  }, [activeHole, idle]);
  const selHole = holeSel != null ? holeGuide(holeSel) : null;
  const strip = idle && !selHole && !!near;

  useEffect(() => { onReport({ pins, trail, showing: !!selHole || strip }); }, [pins, trail, selHole, strip]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onReport({ pins: [], trail: null, showing: false }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Frame the chosen hole in the upper part of the screen (its card covers the lower half).
  useEffect(() => {
    if (holeSel == null) return;
    const g = holeGuide(holeSel);
    if (!g) return;
    const pts = [g.tee, holeMid(holeSel), g.green];
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const zoom = Math.min(3, Math.max(1.5, 0.4 * Math.min(100 / Math.max(w, 3), 100 / Math.max(h, 3))));
    onFocus({ pt: [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2], zoom, exact: true, offsetY: -window.innerHeight * 0.2, nonce: Date.now() });
  }, [holeSel, frameSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!idle) return null;
  if (selHole) {
    return (
      <HoleCard
        key={selHole.n}
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 right-[4.5rem] z-40 sm:left-24 sm:right-auto sm:w-[28rem]"
        hole={selHole}
        yards={near && near.hole.n === selHole.n ? near.yards : null}
        onClose={onClose}
        onTeeOff={() => onTeeOff(selHole.n)}
        onShowOnMap={() => onSelect(selHole.n)}
        onPick={onSelect}
      />
    );
  }
  if (strip && near) {
    return (
      <button
        onClick={() => onSelect(near.hole.n)}
        className={`pointer-events-auto absolute bottom-[5.6rem] left-3 right-[4.5rem] z-40 flex animate-slide-up items-center gap-3 rounded-[20px] px-3.5 py-2 text-left sm:left-24 sm:right-auto sm:w-[26rem] ${lxIvory}`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1f2a24] font-serif text-[22px] font-bold text-[#ffd9bf] ring-1 ring-[#e3d8c2]">{near.hole.n}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[18px] font-semibold leading-tight text-[#26231f]">You&rsquo;re on Hole {near.hole.n} &middot; Par {near.hole.par}</span>
          <span className="block text-[12px] text-[#5b5a4c]">{Math.round(near.yards)} yards to the green &middot; tap for the hole</span>
        </span>
      </button>
    );
  }
  return null;
}
