import type { CSSProperties } from 'react';
import { HOLE_GUIDE } from '@/lib/holes';

// Small touches on top of the map: flags that wave on every green, and a glint of sun on the clubhouse roof.

type Pt = [number, number];

const CLUBHOUSE: Pt = [40.05, 58.1];

function Flag({ size }: { size: number }) {
  return (
    <svg width={size * 0.7} height={size} viewBox="0 0 21 30" className="overflow-visible drop-shadow">
      <line x1="4" y1="28" x2="4" y2="3" stroke="#f1d9a6" strokeWidth="1.5" strokeLinecap="round" />
      <g style={{ transformOrigin: '4px 8px', animation: 'zh-wave 2.6s ease-in-out infinite' }}>
        <path d="M4.5 3 L18 6.5 L4.5 11 Z" fill="#f05a22" stroke="#fbf7ee" strokeWidth="0.8" strokeLinejoin="round" />
      </g>
      <circle cx="4" cy="28.3" r="2" fill="#0f2118" stroke="#f1d9a6" strokeWidth="0.9" />
    </svg>
  );
}

export function AmbientLayer({ toScreen, zoom, upright, sun, safe, viewport }: {
  toScreen: (p: Pt) => number[];
  zoom: number;
  upright?: CSSProperties;
  /** 0..1 how bright the sun is (0 at night): the roof glint shows only by day. */
  sun: number;
  safe?: { top: number; bottom: number; right: number; left: number } | null;
  viewport?: { width: number; height: number };
}) {
  const clear = (x: number, y: number) => !safe || !viewport || (y > safe.top && y < viewport.height - safe.bottom && x < viewport.width - safe.right && x > safe.left);
  const k = Math.min(1.7, Math.max(0.85, zoom / 2));
  const fade = Math.min(1, Math.max(0, (zoom - 1.5) / 0.4));
  const [cx, cy] = toScreen(CLUBHOUSE);
  return (
    <div className="zh-anim pointer-events-none absolute inset-0">
      {fade > 0 && HOLE_GUIDE.map((h) => {
        const [x, y] = toScreen(h.green);
        if (!clear(x, y)) return null;
        return (
          <div key={h.n} className="absolute" style={{ left: x, top: y, zIndex: 13, opacity: fade, ...upright, transformOrigin: '0 0' }}>
            <div className="absolute -translate-x-[18%] -translate-y-full"><Flag size={30 * k} /></div>
          </div>
        );
      })}
      {sun > 0.3 && zoom > 1.2 && clear(cx, cy) && (
        <div className="absolute" style={{ left: cx, top: cy, zIndex: 16, ...upright, transformOrigin: '0 0' }}>
          <svg width={26 * k} height={26 * k} viewBox="-13 -13 26 26" className="absolute -translate-x-1/2 -translate-y-1/2 overflow-visible" style={{ animation: 'zh-glint 8s ease-in-out infinite' }}>
            <path d="M0 -12 L1.6 -1.6 L12 0 L1.6 1.6 L0 12 L-1.6 1.6 L-12 0 L-1.6 -1.6 Z" fill="#fffbe8" />
            <circle r="3" fill="#fff" opacity="0.9" />
          </svg>
        </div>
      )}
    </div>
  );
}
