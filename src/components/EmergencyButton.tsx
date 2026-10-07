import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, Siren, MapPin, Share2, Navigation2, X, Check, Loader2 } from 'lucide-react';
import { AMENITIES, VILLAS, PLOT_PLACES, findRoute, planMetres } from '@/lib/directions';
import { AMBULANCE, NATIONAL_EMERGENCY, SITE_CONTACT } from '@/lib/emergency';
import { distanceWords } from '@/lib/turns';
import type { MapPt } from '@/lib/tour';
import { lxCrimson, lxEyebrow, lxIvory, lxOrange } from '@/lib/luxury';

// Emergency help on the public map: one tap to call, the visitor's location ready to send,
// and the way to the main gate.

const NAMED = [...AMENITIES, ...VILLAS, ...PLOT_PLACES];

/** The closest named place (plot, villa, amenity) to a point on the plan, in words. */
function nearTo(pt: MapPt): string {
  let best = NAMED[0], bd = Infinity;
  for (const p of NAMED) {
    const d = Math.hypot((p.pt[0] - pt[0]) * 23.7, (p.pt[1] - pt[1]) * 16.9);
    if (d < bd) { bd = d; best = p; }
  }
  return bd < 250 ? `near ${best.label}` : '';
}

export function EmergencyButton({ position, onPlan, locating, onLocate, onRouteToGate }: {
  /** The visitor's GPS position, once they have asked to be located. */
  position: { lat: number; lng: number } | null;
  /** Where they are on the plan (null when unknown or off the estate). */
  onPlan: MapPt | null;
  locating: boolean;
  onLocate: () => void;
  onRouteToGate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const gate = AMENITIES.find((a) => a.id === 'entry-main')!;

  const toGate = useMemo(() => {
    if (!onPlan) return null;
    const r = findRoute(onPlan, gate.pt);
    return r ? planMetres(r.points) : null;
  }, [onPlan?.[0], onPlan?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  const near = onPlan ? nearTo(onPlan) : '';
  const mapLink = position ? `https://maps.google.com/?q=${position.lat.toFixed(6)},${position.lng.toFixed(6)}` : '';
  const message = `I need help at Zion Hills Golf County${near ? ` (${near})` : ''}.${mapLink ? ` My location: ${mapLink}` : ''}`;

  async function share() {
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    try {
      if (nav.share) { await nav.share({ text: message }); return; }
      await navigator.clipboard.writeText(message);
      setShared(true);
      window.setTimeout(() => setShared(false), 2500);
    } catch { /* cancelled, or clipboard unavailable */ }
  }

  const call = 'flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left font-semibold active:scale-[0.98]';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Emergency help"
        className={`pointer-events-auto flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold tracking-[0.12em] transition hover:brightness-110 ${lxCrimson}`}
      >
        <Siren className="h-4 w-4" /> SOS
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#07120c]/60 backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Emergency help"
            onClick={(e) => e.stopPropagation()}
            className={`max-h-[92dvh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-[28px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[28px] ${lxIvory}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`${lxEyebrow} text-[#a3241c]`}>Zion Hills · Guest safety</div>
                <h2 className="mt-0.5 flex items-center gap-2 font-serif text-[28px] font-semibold leading-none text-[#13261c]"><Siren className="h-6 w-6 text-[#a3241c]" /> Emergency help</h2>
                <p className="mt-1.5 text-[13px] leading-snug text-[#5b5a4c]">If someone is hurt, call first. Stay where you are unless it isn&rsquo;t safe.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2 text-[#6f5f2f] hover:bg-[#c9a96e]/[0.15]"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-4 space-y-2.5">
              <a href={`tel:${NATIONAL_EMERGENCY.phone}`} className={`${call} ${lxCrimson}`}>
                <Phone className="h-6 w-6 shrink-0" />
                <span className="flex-1"><span className="block font-serif text-[22px] font-semibold leading-tight">Call {NATIONAL_EMERGENCY.phone}</span><span className="block text-[12px] font-medium text-white/[0.85]">{NATIONAL_EMERGENCY.label} · police, fire, ambulance</span></span>
              </a>
              <a href={`tel:${AMBULANCE.phone}`} className={`${call} bg-[#fbeeea] text-[#8f1d17] ring-1 ring-[#a3241c]/30`}>
                <Phone className="h-5 w-5 shrink-0" />
                <span className="flex-1"><span className="block font-serif text-[20px] font-semibold leading-tight">Call {AMBULANCE.phone}</span><span className="block text-[12px] font-medium text-[#8f1d17]/80">{AMBULANCE.label}</span></span>
              </a>
              {SITE_CONTACT && (
                <a href={`tel:${SITE_CONTACT.phone}`} className={`${call} bg-[#13261c] text-[#f3ead3] ring-1 ring-[#c9a96e]/[0.45]`}>
                  <Phone className="h-5 w-5 shrink-0" />
                  <span className="flex-1"><span className="block text-[16px] leading-tight">Call {SITE_CONTACT.label}</span><span className="block text-[12px] font-medium text-white/70">{SITE_CONTACT.phone}</span></span>
                </a>
              )}
            </div>

            <div className="mt-4 rounded-2xl bg-[#f3ecda] p-4 ring-1 ring-[#c9a96e]/[0.35]">
              <div className={`flex items-center gap-2 ${lxEyebrow} text-[#6f5f2f]`}><MapPin className="h-4 w-4" /> Where you are</div>
              {position ? (
                <>
                  <p className="mt-1.5 font-serif text-[20px] font-semibold text-[#13261c]">{near ? `You are ${near}` : onPlan ? 'You are on the estate' : 'Your location is ready to send'}</p>
                  <p className="text-[12px] tabular-nums text-[#7a7358]">{position.lat.toFixed(5)}, {position.lng.toFixed(5)}</p>
                  <button onClick={share} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#13261c] py-3 text-[15px] font-semibold text-[#f3ead3] ring-1 ring-[#c9a96e]/[0.45] active:scale-[0.98]">
                    {shared ? <><Check className="h-4 w-4" /> Copied — paste it into a message</> : <><Share2 className="h-4 w-4" /> Send my location</>}
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-[14px] text-[#5b5a4c]">Share your position so someone can find you.</p>
                  <button onClick={onLocate} disabled={locating} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#13261c] py-3 text-[15px] font-semibold text-[#f3ead3] ring-1 ring-[#c9a96e]/[0.45] disabled:opacity-70 active:scale-[0.98]">
                    {locating ? <><Loader2 className="h-4 w-4 animate-spin" /> Finding you…</> : <><MapPin className="h-4 w-4" /> Find my location</>}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => { setOpen(false); onRouteToGate(); }}
              className={`mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left font-semibold active:scale-[0.98] ${lxOrange}`}
            >
              <Navigation2 className="h-5 w-5 shrink-0" />
              <span className="flex-1">
                <span className="block font-serif text-[20px] font-semibold leading-tight">Way out: {gate.label}</span>
                <span className="block text-[12px] font-medium text-white/[0.85]">{toGate != null ? `${distanceWords(toGate)} by road · show the route` : 'Show directions to the gate'}</span>
              </span>
            </button>
            <p className="mt-3 text-center text-[12px] text-[#6f5f2f]">Tell the operator your plot or villa number, or the nearest landmark on the map.</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
