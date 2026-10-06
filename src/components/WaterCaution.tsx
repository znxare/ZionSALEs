import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Waves } from 'lucide-react';
import { nearestWater, WATER_CAUTION_M, WATER_CLEAR_M, WATER_DANGER_M } from '@/lib/water';
import type { MapPt } from '@/lib/tour';
import { speak } from '@/lib/voice';
import { playAlarm } from '@/lib/alarm';

// Deep-water caution for anyone with a live position: a banner and a red outline round
// the lake once they come within WATER_CAUTION_M of its edge.

export interface WaterAlert { index: number; metres: number; danger: boolean; /** After 6 pm: the lake area is not to be entered. */ night: boolean }

/** Lake areas are out of bounds after dark: from 6 pm to 6 am (estate time, whatever the phone's clock says). */
export const NIGHT_FROM_HOUR = 18;
export const NIGHT_UNTIL_HOUR = 6;

export function isLakeCurfew(now: Date = new Date()): boolean {
  let hour = now.getHours();
  try {
    const h = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(now);
    hour = Number(h);
  } catch { /* fall back to the phone's own clock */ }
  return hour >= NIGHT_FROM_HOUR || hour < NIGHT_UNTIL_HOUR;
}

const NIGHT_SPEECH = 'Warning. The lake area is not permitted after six P M. Please move away from the water for your safety.';
const DAY_SPEECH = 'Caution. Deep water nearby. Keep clear of the water’s edge.';

/** The lake the position is close to (null when clear). Two distances (in past one, out past the other) so a wobbly GPS doesn't flicker. */
export function useWaterCaution(pt: MapPt | null): WaterAlert | null {
  const [alert, setAlert] = useState<WaterAlert | null>(null);
  const px = pt?.[0], py = pt?.[1];
  const wasNear = useRef(false);
  useEffect(() => {
    if (px === undefined || py === undefined) { wasNear.current = false; setAlert(null); return; }
    const { index, metres } = nearestWater([px, py]);
    const near = wasNear.current ? metres <= WATER_CLEAR_M : metres <= WATER_CAUTION_M;
    const night = isLakeCurfew();
    if (near && !wasNear.current) {
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
      speak(night ? NIGHT_SPEECH : DAY_SPEECH);
      if (night) playAlarm();
    }
    wasNear.current = near;
    setAlert((prev) => {
      if (!near) return prev ? null : prev;
      const danger = metres <= WATER_DANGER_M;
      return prev && prev.index === index && prev.danger === danger && prev.night === night && Math.abs(prev.metres - metres) < 3 ? prev : { index, metres, danger, night };
    });
  }, [px, py]);

  // After 6 pm the warning keeps sounding (siren every 6 s, spoken every 24 s) until they move away.
  const night = !!alert?.night;
  useEffect(() => {
    if (!night) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      try { navigator.vibrate?.([300, 150, 300]); } catch { /* not supported */ }
      if (n % 4 === 0) speak(NIGHT_SPEECH); else playAlarm();
    }, 6000);
    return () => window.clearInterval(id);
  }, [night]);
  return alert;
}

export function WaterCautionBanner({ alert, top = 'top-[9.75rem]' }: { alert: WaterAlert | null; top?: string }) {
  if (!alert) return null;
  const { danger, night } = alert;
  return (
    <div
      role="alert"
      className={`pointer-events-none absolute inset-x-3 ${top} z-50 mx-auto flex max-w-md animate-slide-up items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-xl ring-1 ring-white/30 ${danger || night ? 'bg-red-700' : 'bg-red-600/95'}`}
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 ${danger ? 'animate-pulse' : ''}`}>
        {danger || night ? <AlertTriangle className="h-6 w-6" /> : <Waves className="h-6 w-6" />}
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-bold leading-tight">{night ? 'Lake area closed after 6 PM' : danger ? 'Deep water right here — stay back' : 'Caution: deep water nearby'}</div>
        <div className="text-[12.5px] leading-snug text-white/90">
          {night ? 'Going near the water at night is not permitted and not advisable. Move away from the edge now.' : danger ? 'Stop and move away from the edge. The bank can be steep and slippery.' : 'Keep well clear of the water’s edge. The lake is deep.'}
        </div>
      </div>
    </div>
  );
}
