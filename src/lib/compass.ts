import { useCallback, useEffect, useRef, useState } from 'react';

// The direction the traveller is facing, from the phone's compass sensor, so the map and the
// compass know it even when standing still (GPS only knows the way you are moving).
//
//  - Android (Chrome) gives an absolute orientation: heading = 360 - alpha, with tilt compensation.
//  - iPhone / iPad give `webkitCompassHeading` directly, but only after the person agrees to a
//    permission prompt, which must come from a tap (see `request`).
//
// Readings arrive up to 60 times a second and jitter, so they are low-passed on the unit circle
// (no jump at 359 -> 0) before being handed on at no more than ~30 updates a second.

const RAD = Math.PI / 180;
const SMOOTH_SECONDS = 0.08;
const MIN_STEP_DEG = 0.4;

type OrientationEventIOS = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
type DeviceOrientationStatic = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

function screenAngle(): number {
  try { return window.screen.orientation?.angle ?? 0; } catch { return 0; }
}

/** Compass heading (degrees clockwise from north) the top of the screen points to, from one sensor reading. */
export function headingFromEvent(e: OrientationEventIOS): number | null {
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
    return (e.webkitCompassHeading + screenAngle() + 360) % 360;
  }
  if (e.alpha == null) return null;
  const beta = e.beta ?? 0, gamma = e.gamma ?? 0;
  let h: number;
  if (Math.abs(beta) < 40) {
    // Held fairly flat: the top edge's direction.
    h = 360 - e.alpha;
  } else {
    // Held up in front of you: the direction the back of the phone points to, tilt-compensated.
    const x = beta * RAD, y = gamma * RAD, z = e.alpha * RAD;
    const cY = Math.cos(y), cZ = Math.cos(z), sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
    const vx = -cZ * sY - sZ * sX * cY;
    const vy = -sZ * sY + cZ * sX * cY;
    h = (Math.atan2(vx, vy) / RAD + 360) % 360;
  }
  return (h + screenAngle() + 360) % 360;
}

export function useDeviceHeading(enabled: boolean): { heading: number | null; request: () => void; /** The sensor says it is unsure (iPhone/iPad: accuracy worse than 25 degrees, or uncalibrated). */ weak: boolean } {
  const [heading, setHeading] = useState<number | null>(null);
  const [weak, setWeak] = useState(false);
  const [granted, setGranted] = useState(false);

  // iOS asks permission; Android doesn't. Call this from a tap.
  const request = useCallback(() => {
    const D = (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : undefined) as DeviceOrientationStatic | undefined;
    if (D && typeof D.requestPermission === 'function') {
      D.requestPermission().then((r) => setGranted(r === 'granted')).catch(() => {});
    } else {
      setGranted(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) { setHeading(null); return; }
    const D = (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : undefined) as DeviceOrientationStatic | undefined;
    if (D && typeof D.requestPermission === 'function' && !granted) return; // iOS: wait for the tap
    if (typeof window === 'undefined') return;

    // Unit-vector low-pass, so 359 -> 1 is a 2 degree move, not a 358 degree one.
    let vx = 0, vy = 0, have = false, lastT = 0, lastOut: number | null = null, lastEmit = 0, weakNow = false;
    const onEvent = (ev: Event) => {
      const e = ev as OrientationEventIOS;
      // Android also fires a relative `deviceorientation`; only trust the absolute one (or iOS's compass).
      if (ev.type === 'deviceorientation' && typeof e.webkitCompassHeading !== 'number' && (e as DeviceOrientationEvent & { absolute?: boolean }).absolute !== true) return;
      const h = headingFromEvent(e);
      if (h == null) return;
      if (typeof e.webkitCompassAccuracy === 'number') {
        const bad = e.webkitCompassAccuracy < 0 || e.webkitCompassAccuracy > 25;
        if (bad !== weakNow) { weakNow = bad; setWeak(bad); }
      }
      const now = performance.now();
      const dt = lastT ? Math.min(0.2, (now - lastT) / 1000) : 1;
      lastT = now;
      const k = have ? 1 - Math.exp(-dt / SMOOTH_SECONDS) : 1;
      vx += (Math.cos(h * RAD) - vx) * k;
      vy += (Math.sin(h * RAD) - vy) * k;
      have = true;
      if (now - lastEmit < 33) {
        // Too soon after the last update: send the latest value shortly, so the final reading of a
        // turn is never dropped (a still phone stops sending events).
        if (!trailing) trailing = window.setTimeout(() => { trailing = 0; emit(); }, 36);
        return;
      }
      emit();
    };
    let trailing = 0;
    const emit = () => {
      const out = (Math.atan2(vy, vx) / RAD + 360) % 360;
      lastEmit = performance.now();
      if (lastOut != null && Math.abs(((out - lastOut + 540) % 360) - 180) < MIN_STEP_DEG) return;
      lastOut = out;
      setHeading(out);
    };
    const hasAbsolute = 'ondeviceorientationabsolute' in window;
    window.addEventListener(hasAbsolute ? 'deviceorientationabsolute' : 'deviceorientation', onEvent as EventListener, true);
    return () => { window.clearTimeout(trailing); window.removeEventListener(hasAbsolute ? 'deviceorientationabsolute' : 'deviceorientation', onEvent as EventListener, true); };
  }, [enabled, granted]);

  return { heading, request, weak };
}

/** Mixes two compass bearings on the circle: 0 = all `a`, 1 = all `b`. */
export function blendBearings(a: number, b: number, w: number): number {
  const x = Math.cos(a * RAD) * (1 - w) + Math.cos(b * RAD) * w;
  const y = Math.sin(a * RAD) * (1 - w) + Math.sin(b * RAD) * w;
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Walking pace: trust the phone's compass. At cart speed: trust the GPS course. In between: a mix. */
export function facingBearing(gps: number | null, sensor: number | null, speed: number | null): number | null {
  if (sensor == null) return gps;
  if (gps == null) return sensor;
  const v = speed ?? 0;
  const w = Math.min(1, Math.max(0, (v - 2) / 1.5));
  return w <= 0 ? sensor : w >= 1 ? gps : blendBearings(sensor, gps, w);
}

/** "NE", "SSW"… for a compass bearing. */
export function cardinal(deg: number): string {
  return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}
