import { MapPin } from 'lucide-react';
import type { Plot } from '@/lib/inventory';
import { outlineOf, centroidOf } from '@/lib/plotMap';

// A close-up of the master plan around one plot (sharp map tiles, plot outlined
// in gold) — used on the buyer's invitation page and in the quote PDF.

const MAP_W = 11233, MAP_H = 7946;
const L2 = { name: 'l2', width: 7200, height: 5093, cols: 8, rows: 5, tile: 1024 };

/** Close-up of the master plan around one plot, built from the sharp map tiles. */
export function PlanCrop({ plot, widthPct = 9, aspect = 4 / 3, className = 'rounded-2xl', label = true, stroke = '#9a6b12', fill = '#d4a548', pin }: {
  plot: Plot;
  /** How much of the map's width to show (smaller = closer). */
  widthPct?: number;
  aspect?: number;
  className?: string;
  label?: boolean;
  /** Outline colour / fill (default gold). */
  stroke?: string;
  fill?: string;
  /** Drawn exactly on the plot (e.g. a flag), even when the crop is shifted at the map's edge. */
  pin?: React.ReactNode;
}) {
  const L = L2;
  const [cx, cy] = centroidOf(plot);
  const rw = widthPct;
  const rh = (rw * MAP_W) / (aspect * MAP_H);
  const rx = Math.min(100 - rw, Math.max(0, cx - rw / 2));
  const ry = Math.min(100 - rh, Math.max(0, cy - rh / 2));
  const tiles: { key: string; src: string; style: React.CSSProperties }[] = [];
  for (let ty = 0; ty < L.rows; ty++) {
    for (let tx = 0; tx < L.cols; tx++) {
      const left = (tx * L.tile * 100) / L.width, top = (ty * L.tile * 100) / L.height;
      const right = Math.min(100, ((tx + 1) * L.tile * 100) / L.width), bottom = Math.min(100, ((ty + 1) * L.tile * 100) / L.height);
      if (right < rx || left > rx + rw || bottom < ry || top > ry + rh) continue;
      tiles.push({
        key: `${tx}-${ty}`,
        src: `/master-plan/${L.name}/${tx}_${ty}.webp`,
        // +1px so neighbouring tiles overlap instead of leaving hairline seams.
        style: { left: `${((left - rx) / rw) * 100}%`, top: `${((top - ry) / rh) * 100}%`, width: `calc(${((right - left) / rw) * 100}% + 1px)`, height: `calc(${((bottom - top) / rh) * 100}% + 1px)` },
      });
    }
  }
  return (
    <div className={`relative w-full overflow-hidden bg-[#d7dac7] ${className}`} style={{ aspectRatio: String(aspect) }}>
      {tiles.map((t) => <img key={t.key} src={t.src} alt="" className="absolute max-w-none" style={t.style} />)}
      <svg className="absolute inset-0 h-full w-full" viewBox={`${rx} ${ry} ${rw} ${rh}`} preserveAspectRatio="none">
        <polygon
          points={outlineOf(plot).map(([x, y]) => `${x},${y}`).join(' ')}
          fill={fill}
          fillOpacity={0.5}
          stroke={stroke}
          strokeWidth={3.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      {pin && <div className="absolute" style={{ left: `${((cx - rx) / rw) * 100}%`, top: `${((cy - ry) / rh) * 100}%` }}>{pin}</div>}
      {label && (
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold text-gray-800 shadow">
          <MapPin className="h-3.5 w-3.5 text-[#a8884f]" /> Plot {plot.plotNo}
        </div>
      )}
    </div>
  );
}
