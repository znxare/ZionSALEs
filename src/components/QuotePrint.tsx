import { useEffect, useState } from 'react';
import type { Plot } from '@/lib/inventory';
import { centroidOf, formatCrore, formatLakh } from '@/lib/plotMap';
import type { HostCard } from '@/lib/showcase';
import type { Yardage } from '@/lib/directions';
import { PlanCrop } from './PlanCrop';

// The buyer's quote as a printed piece (what "Save as PDF" produces): three A4
// pages built around a golfer's yardage book — the plot from above, with the
// distances that matter — then the price laid out like a scorecard and one
// clear next step. Only shown when printing; the web page is separate.

const LOGO = '/zion-hills-logo.svg';
const FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Libre+Caslon+Display&display=swap';

// Palette taken from the master plan itself.
const C = {
  pine: '#1f2a1c',     // ink
  fairway: '#4f7f2a',  // greens
  lake: '#3c7a92',     // water
  bunker: '#efe6cf',   // sand
  flag: '#e9592c',     // the logo's flag
  mute: '#6b7064',
  rule: '#d9d3c1',
};
const display = { fontFamily: "'Libre Caslon Display', Georgia, serif", fontWeight: 400 } as const;
const cond = { fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif" } as const;

const PAGE: React.CSSProperties = { width: '210mm', height: '297mm', position: 'relative', overflow: 'hidden', breakAfter: 'page', background: '#fff', color: C.pine };

/** Loads the PDF's fonts (only for buyers' quote pages). */
export function usePrintFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONTS}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTS;
    document.head.appendChild(l);
  }, []);
}

function Flag({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 32 40" style={{ overflow: 'visible' }}>
      <ellipse cx="6" cy="38.5" rx="5" ry="1.6" fill="rgba(0,0,0,0.28)" />
      <line x1="6" y1="38" x2="6" y2="3" stroke={C.pine} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7 3 L29 9.5 L7 16 Z" fill={C.flag} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function Eyebrow({ children, color = C.fairway }: { children: React.ReactNode; color?: string }) {
  return <div style={{ ...cond, fontWeight: 600, fontSize: '10pt', letterSpacing: '0.22em', textTransform: 'uppercase', color }}>{children}</div>;
}

function Footer({ page, plotNo }: { page: number; plotNo: string }) {
  return (
    <div style={{ position: 'absolute', left: '16mm', right: '16mm', bottom: '10mm', display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...cond, fontSize: '8.5pt', letterSpacing: '0.16em', textTransform: 'uppercase', color: C.mute }}>
      <span>Zion Hills Golf County · Plot {plotNo}</span>
      <span>{page} / 3</span>
    </div>
  );
}

export function QuotePrint({ plot, buyer, sender, host, render, view, link, yardages, qr, today }: {
  plot: Plot;
  buyer?: string;
  sender?: string;
  host?: HostCard;
  render?: string;
  view?: string;
  link: string;
  yardages: Yardage[] | null;
  qr: string | null;
  today: string;
}) {
  const k = plot.cost;
  const [cx, cy] = centroidOf(plot);
  const fmtDist = (m: number) => (m < 950 ? { n: String(Math.max(10, Math.round(m / 10) * 10)), u: 'm' } : { n: (m / 1000).toFixed(1), u: 'km' });
  const minutes = (m: number) => Math.max(1, Math.round(m / 200));
  const rows: [string, number][] = [
    ['Land', k.landCostLacs],
    ['Villa construction', k.constnCostLacs],
    ['Club membership', k.clubChargesLacs],
    ['Landscaping', k.landscapeChargesLacs],
    ['Utilities', k.utilityChargesLacs],
    ['GST', k.gstLacs],
  ];

  return (
    <div className="quote-print" style={{ fontFamily: 'Inter, Arial, sans-serif', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      <style>{'@page { size: A4; margin: 0 } .quote-print > div:last-child { break-after: auto }'}</style>

      {/* ---------- 1. Cover ---------- */}
      <div style={PAGE}>
        <div style={{ position: 'absolute', inset: 0, height: '178mm' }}>
          {render ? (
            <img src={render} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <PlanCrop plot={plot} widthPct={7.5} aspect={210 / 178} className="h-full" label={false} stroke={C.flag} fill={C.flag}
              pin={<div style={{ transform: 'translate(-6px, -100%)' }}><Flag size={40} /></div>} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.75) 14%, rgba(255,255,255,0) 32%)' }} />
        </div>
        <div style={{ position: 'absolute', top: '12mm', left: '16mm', right: '16mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <img src={LOGO} alt="Zion Hills Golf County" style={{ height: '17mm', width: 'auto' }} />
          <div style={{ textAlign: 'right' }}>
            <Eyebrow color={C.pine}>Prepared for</Eyebrow>
            <div style={{ ...display, fontSize: '17pt', lineHeight: 1.1, marginTop: '1mm' }}>{buyer || 'You'}</div>
            <div style={{ ...cond, fontSize: '10pt', color: C.mute, marginTop: '1mm', letterSpacing: '0.08em' }}>{today}</div>
          </div>
        </div>

        <div style={{ position: 'absolute', top: '188mm', left: '16mm', right: '16mm' }}>
          <Eyebrow>{plot.phase} · {plot.bedrooms}-bedroom golf villa</Eyebrow>
          <div style={{ ...display, fontSize: '64pt', lineHeight: 0.95, marginTop: '3mm', letterSpacing: '-0.01em' }}>
            Plot {plot.plotNo}
          </div>
          <div style={{ display: 'flex', gap: '9mm', marginTop: '7mm', ...cond }}>
            {[
              [Math.round(plot.landAreaSft).toLocaleString('en-IN'), 'sq ft of land'],
              [plot.builtUpSft.toLocaleString('en-IN'), 'sq ft built-up'],
              [String(plot.bedrooms), 'bedrooms'],
            ].map(([n, l]) => (
              <div key={l}>
                <div style={{ fontWeight: 600, fontSize: '22pt', lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: '9pt', letterSpacing: '0.16em', textTransform: 'uppercase', color: C.mute, marginTop: '1mm' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '34mm', background: C.pine, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16mm' }}>
          <div>
            <div style={{ ...cond, fontSize: '9pt', letterSpacing: '0.22em', textTransform: 'uppercase', color: C.bunker, opacity: 0.85 }}>All-inclusive, with GST</div>
            <div style={{ ...display, fontSize: '30pt', lineHeight: 1.05 }}>{formatCrore(k.totalCostLacs)}</div>
          </div>
          {sender && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...cond, fontSize: '9pt', letterSpacing: '0.22em', textTransform: 'uppercase', color: C.bunker, opacity: 0.85 }}>Your host</div>
              <div style={{ ...display, fontSize: '16pt' }}>{sender}</div>
              {host?.phone && <div style={{ ...cond, fontSize: '12pt', letterSpacing: '0.06em' }}>{host.phone}</div>}
            </div>
          )}
        </div>
      </div>

      {/* ---------- 2. The yardage ---------- */}
      <div style={{ ...PAGE, padding: '14mm 16mm 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1.5pt solid ${C.pine}`, paddingBottom: '3mm' }}>
          <div>
            <Eyebrow>Your yardage</Eyebrow>
            <div style={{ ...display, fontSize: '26pt', lineHeight: 1.05, marginTop: '1mm' }}>Plot {plot.plotNo}, from above</div>
          </div>
          <img src={LOGO} alt="" style={{ height: '10mm', width: 'auto' }} />
        </div>

        <div style={{ position: 'relative', marginTop: '6mm', borderRadius: '3mm', overflow: 'hidden', border: `0.5pt solid ${C.rule}` }}>
          <PlanCrop plot={plot} widthPct={11} aspect={178 / 98} className="" label={false} stroke={C.flag} fill={C.flag}
            pin={<div style={{ transform: 'translate(-6px, -100%)' }}><Flag /></div>} />
          <div style={{ position: 'absolute', right: '3mm', top: '3mm', background: 'rgba(255,255,255,0.92)', borderRadius: '2mm', padding: '1.5mm 2.5mm', ...cond, fontSize: '9pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.pine }}>
            Plot {plot.plotNo} · outlined
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6mm' }}>
          <Eyebrow color={C.pine}>Distances by road, from your plot</Eyebrow>
          <span style={{ ...cond, fontSize: '9pt', color: C.mute, letterSpacing: '0.08em' }}>Cart times at an easy 12 km/h</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '6mm', rowGap: '5mm', marginTop: '4mm' }}>
          {(yardages ?? []).map((y) => {
            const d = fmtDist(y.metres);
            return (
              <div key={y.label} style={{ borderTop: `3pt solid ${y.note ? C.fairway : C.lake}`, paddingTop: '2.5mm' }}>
                <div style={{ ...cond, lineHeight: 0.9 }}>
                  <span style={{ fontWeight: 700, fontSize: '34pt' }}>{d.n}</span>
                  <span style={{ fontWeight: 600, fontSize: '14pt', marginLeft: '1mm', color: C.mute }}>{d.u}</span>
                </div>
                <div style={{ fontSize: '10.5pt', fontWeight: 600, marginTop: '1.5mm' }}>{y.label}</div>
                <div style={{ fontSize: '8.5pt', color: C.mute }}>{y.note ? `${y.note} · ` : ''}about {minutes(y.metres)} min by cart</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '6mm', marginTop: '7mm', alignItems: 'stretch', height: '58mm' }}>
          <div style={{ position: 'relative', width: '82mm', borderRadius: '2mm', overflow: 'hidden', border: `0.5pt solid ${C.rule}` }}>
            <img src="/master-plan/l0.webp" alt="" style={{ width: '100%', display: 'block' }} />
            <div style={{ position: 'absolute', left: `${cx}%`, top: `${cy}%`, transform: 'translate(-6px, -100%)' }}><Flag size={24} /></div>
          </div>
          {view ? (
            <div style={{ flex: 1, borderRadius: '2mm', overflow: 'hidden', position: 'relative' }}>
              <img src={view} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', left: '2.5mm', bottom: '2.5mm', background: 'rgba(255,255,255,0.92)', borderRadius: '1.5mm', padding: '1mm 2mm', ...cond, fontSize: '8.5pt', letterSpacing: '0.14em', textTransform: 'uppercase' }}>The view from the plot</div>
            </div>
          ) : (
            <div style={{ flex: 1, background: C.bunker, borderRadius: '2mm', padding: '5mm' }}>
              <Eyebrow>On the estate</Eyebrow>
              <div style={{ ...display, fontSize: '14pt', lineHeight: 1.25, marginTop: '2mm' }}>An 18-hole course threaded with lakes, with your home on it.</div>
              <ul style={{ margin: '3mm 0 0', padding: 0, listStyle: 'none', fontSize: '9.5pt', lineHeight: 1.65 }}>
                {['Club House', 'Golf practice facilities', 'Sports courts', 'Camp site', 'Commercial & residential quarter'].map((a) => (
                  <li key={a} style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
                    <span style={{ width: '1.6mm', height: '1.6mm', borderRadius: '50%', background: C.flag, display: 'inline-block' }} /> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div style={{ ...cond, fontSize: '8.5pt', color: C.mute, letterSpacing: '0.08em', marginTop: '2mm' }}>Where Plot {plot.plotNo} sits on the Zion Hills master plan</div>
        <Footer page={2} plotNo={plot.plotNo} />
      </div>

      {/* ---------- 3. Investment + next step ---------- */}
      <div style={{ ...PAGE, padding: '14mm 16mm 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1.5pt solid ${C.pine}`, paddingBottom: '3mm' }}>
          <div>
            <Eyebrow>Your investment</Eyebrow>
            <div style={{ ...display, fontSize: '26pt', lineHeight: 1.05, marginTop: '1mm' }}>The card for Plot {plot.plotNo}</div>
          </div>
          <img src={LOGO} alt="" style={{ height: '10mm', width: 'auto' }} />
        </div>

        {/* Scorecard */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '7mm', fontSize: '11pt' }}>
          <thead>
            <tr style={{ background: C.pine, color: '#fff', ...cond, fontSize: '10pt', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              <th style={{ textAlign: 'left', padding: '2.5mm 4mm', fontWeight: 600 }}>Item</th>
              <th style={{ textAlign: 'right', padding: '2.5mm 4mm', fontWeight: 600 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, v], i) => (
              <tr key={label} style={{ background: i % 2 ? C.bunker : '#fff', borderBottom: `0.5pt solid ${C.rule}` }}>
                <td style={{ padding: '3mm 4mm' }}>{label}</td>
                <td style={{ padding: '3mm 4mm', textAlign: 'right', ...cond, fontWeight: 600, fontSize: '13pt' }}>{formatLakh(v)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2pt solid ${C.pine}` }}>
              <td style={{ padding: '5mm 4mm 2mm', ...cond, fontSize: '11pt', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>Total, all-inclusive</td>
              <td style={{ padding: '5mm 4mm 2mm', textAlign: 'right', ...display, fontSize: '30pt', color: C.pine }}>{formatCrore(k.totalCostLacs)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Next step */}
        <div style={{ marginTop: '16mm', background: C.pine, color: '#fff', borderRadius: '3mm', padding: '9mm', display: 'flex', gap: '8mm', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...cond, fontSize: '10pt', letterSpacing: '0.22em', textTransform: 'uppercase', color: C.bunker, opacity: 0.85 }}>Your next step</div>
            <div style={{ ...display, fontSize: '22pt', lineHeight: 1.15, marginTop: '2mm' }}>Walk Plot {plot.plotNo} with us — we'll have a cart waiting.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4mm', marginTop: '6mm' }}>
              {host?.photo ? (
                <img src={host.photo} alt="" style={{ width: '15mm', height: '15mm', borderRadius: '50%', objectFit: 'cover', border: '1pt solid rgba(255,255,255,0.6)' }} />
              ) : (
                <div style={{ width: '15mm', height: '15mm', borderRadius: '50%', background: C.flag, display: 'grid', placeItems: 'center', ...display, fontSize: '18pt' }}>{(sender ?? 'Z').charAt(0)}</div>
              )}
              <div>
                <div style={{ fontSize: '12pt', fontWeight: 600 }}>{sender ?? 'Zion Hills sales'}{host?.title ? <span style={{ fontWeight: 400, opacity: 0.75 }}> · {host.title}</span> : null}</div>
                {host?.phone && <div style={{ ...cond, fontSize: '15pt', letterSpacing: '0.06em' }}>Call or WhatsApp {host.phone}</div>}
              </div>
            </div>
          </div>
          {qr && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: '#fff', borderRadius: '2mm', padding: '2mm', lineHeight: 0 }}>
                <img src={qr} alt="" style={{ width: '32mm', height: '32mm' }} />
              </div>
              <div style={{ ...cond, fontSize: '8.5pt', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '2mm', maxWidth: '38mm', lineHeight: 1.3 }}>Scan for your live invitation</div>
            </div>
          )}
        </div>

        <p style={{ fontSize: '8pt', lineHeight: 1.6, color: C.mute, marginTop: '10mm' }}>
          Prepared on {today}{buyer ? ` for ${buyer}` : ''}. Prices are indicative and subject to change; the final price is as per the sale agreement.
          Distances are measured along the estate's roads on the master plan and are approximate. {render || view ? "Images are artist's impressions. " : ''}
          Online: <span style={{ color: C.pine }}>{link.replace(/^https?:\/\//, '')}</span>
        </p>
        <Footer page={3} plotNo={plot.plotNo} />
      </div>
    </div>
  );
}

/** Everything the PDF computes (distances, QR) — started as soon as the page opens. */
export function usePrintData(plot: Plot | null, link: string) {
  const [yardages, setYardages] = useState<Yardage[] | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!plot) return;
    let live = true;
    void import('@/lib/directions').then((d) => { if (live) setYardages(d.yardagesFrom(centroidOf(plot))); });
    void import('qrcode').then((q) => q.toDataURL(link, { margin: 0, width: 360, color: { dark: C.pine, light: '#ffffff' } })).then((u) => { if (live) setQr(u); }).catch(() => {});
    return () => { live = false; };
  }, [plot, link]);
  return { yardages, qr, ready: yardages !== null };
}
