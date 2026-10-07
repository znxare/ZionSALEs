import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Waves } from 'lucide-react';
import { nearestWater, WATER_CAUTION_M, WATER_MAX_GPS_ERROR_M, WATER_REARM_M } from '@/lib/water';
import type { MapPt } from '@/lib/tour';
import { speak } from '@/lib/voice';
import { playAlarm } from '@/lib/alarm';
import { lxCrimson } from '@/lib/luxury';

// Deep-water caution for anyone with a live position: a banner and a red outline round
// the lake once, when they are right at its edge (within WATER_CAUTION_M).

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

const SHOW_MS = 9000;

/**
 * The warning for someone right at the water's edge. It goes off ONCE (banner, one siren after
 * 6 pm, one spoken line, one buzz), then stays quiet until they have moved well away and come back.
 * `accuracyM` is the GPS error; a vague position never raises it.
 */
export function useWaterCaution(pt: MapPt | null, accuracyM: number | null = null): WaterAlert | null {
  const [alert, setAlert] = useState<WaterAlert | null>(null);
  const px = pt?.[0], py = pt?.[1];
  const armed = useRef(true);
  const hideTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  useEffect(() => {
    if (px === undefined || py === undefined) { armed.current = true; window.clearTimeout(hideTimer.current); setAlert(null); return; }
    if (accuracyM != null && accuracyM > WATER_MAX_GPS_ERROR_M) return;
    const { index, metres } = nearestWater([px, py]);
    if (metres > WATER_REARM_M) {
      armed.current = true;
      window.clearTimeout(hideTimer.current);
      setAlert((prev) => (prev ? null : prev));
      return;
    }
    if (metres <= WATER_CAUTION_M && armed.current) {
      armed.current = false;
      const night = isLakeCurfew();
      try { navigator.vibrate?.(night ? [300, 150, 300] : [200, 100, 200]); } catch { /* not supported */ }
      if (night) playAlarm();
      speak(night ? NIGHT_SPEECH : DAY_SPEECH);
      setAlert({ index, metres, danger: true, night });
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setAlert(null), SHOW_MS);
    }
  }, [px, py, accuracyM]);

  return alert;
}

export function WaterCautionBanner({ alert, top = 'top-[9.75rem]' }: { alert: WaterAlert | null; top?: string }) {
  if (!alert) return null;
  const { danger, night } = alert;
  return (
    <div
      role="alert"
      className={`pointer-events-none absolute left-3 right-[4.75rem] sm:right-3 ${top} z-50 mx-auto flex max-w-md animate-slide-up items-center gap-3 rounded-[20px] px-4 py-3 ${lxCrimson}`}
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ffd9bf]/20 ring-1 ring-[#ffd9bf]/50 ${danger ? 'animate-pulse' : ''}`}>
        {danger || night ? <AlertTriangle className="h-6 w-6" /> : <Waves className="h-6 w-6" />}
      </div>
      <div className="min-w-0">
        <div className="font-serif text-[19px] font-semibold leading-tight">{night ? 'Lake area closed after 6 PM' : danger ? 'Deep water right here — stay back' : 'Caution: deep water nearby'}</div>
        <div className="text-[12.5px] leading-snug text-white/90">
          {night ? 'Not permitted and not advisable at night. Move away from the edge now.' : danger ? 'Stop and move away from the edge. The bank can be steep and slippery.' : 'Keep clear of the water’s edge. The lake is deep.'}
        </div>
      </div>
    </div>
  );
}
