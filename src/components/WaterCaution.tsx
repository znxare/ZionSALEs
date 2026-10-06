import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Waves } from 'lucide-react';
import { nearestWater, WATER_CAUTION_M, WATER_CLEAR_M, WATER_DANGER_M } from '@/lib/water';
import type { MapPt } from '@/lib/tour';
import { speak } from '@/lib/voice';

// Deep-water caution for anyone with a live position: a banner and a red outline round
// the lake once they come within WATER_CAUTION_M of its edge.

export interface WaterAlert { index: number; metres: number; danger: boolean }

/** The lake the position is close to (null when clear). Two distances (in past one, out past the other) so a wobbly GPS doesn't flicker. */
export function useWaterCaution(pt: MapPt | null): WaterAlert | null {
  const [alert, setAlert] = useState<WaterAlert | null>(null);
  const px = pt?.[0], py = pt?.[1];
  const wasNear = useRef(false);
  useEffect(() => {
    if (px === undefined || py === undefined) { wasNear.current = false; setAlert(null); return; }
    const { index, metres } = nearestWater([px, py]);
    const near = wasNear.current ? metres <= WATER_CLEAR_M : metres <= WATER_CAUTION_M;
    if (near && !wasNear.current) {
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
      speak('Caution. Deep water nearby. Keep clear of the water’s edge.');
    }
    wasNear.current = near;
    setAlert((prev) => {
      if (!near) return prev ? null : prev;
      const danger = metres <= WATER_DANGER_M;
      return prev && prev.index === index && prev.danger === danger && Math.abs(prev.metres - metres) < 3 ? prev : { index, metres, danger };
    });
  }, [px, py]);
  return alert;
}

export function WaterCautionBanner({ alert, top = 'top-[9.75rem]' }: { alert: WaterAlert | null; top?: string }) {
  if (!alert) return null;
  const { danger } = alert;
  return (
    <div
      role="alert"
      className={`pointer-events-none absolute inset-x-3 ${top} z-50 mx-auto flex max-w-md animate-slide-up items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-xl ring-1 ring-white/30 ${danger ? 'bg-red-700' : 'bg-red-600/95'}`}
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 ${danger ? 'animate-pulse' : ''}`}>
        {danger ? <AlertTriangle className="h-6 w-6" /> : <Waves className="h-6 w-6" />}
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-bold leading-tight">{danger ? 'Deep water right here — stay back' : 'Caution: deep water nearby'}</div>
        <div className="text-[12.5px] leading-snug text-white/90">
          {danger ? 'Stop and move away from the edge. The bank can be steep and slippery.' : 'Keep well clear of the water’s edge. The lake is deep.'}
        </div>
      </div>
    </div>
  );
}
