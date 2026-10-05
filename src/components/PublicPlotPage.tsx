import { useEffect, useState } from 'react';
import { Download, MapPin, Phone, MessageCircle, ChevronDown } from 'lucide-react';
import type { Plot } from '@/lib/inventory';
import { findPlot, outlineOf, centroidOf, formatCrore, formatLakh, SHAPE_COLORS } from '@/lib/plotMap';
import { loadPublicShowcase, renderFor, viewFor, type Showcase, type HostCard } from '@/lib/showcase';
import { openQuote } from '@/lib/quoteLinks';
import { VideoModal, TestimonialButton } from './ShowcaseMedia';

// Shared with buyers over WhatsApp — opens without a login. A personal
// invitation rather than a price sheet: their name, what the home will look
// like, the view, the price laid out simply, and their host's direct line.
// Nothing internal (other buyers, holds, notes, rates) is on this page.
//
//   #/q/<link id>  tracked quote (the team sees when it's opened)
//   #/p/<plot id>?to=<buyer>&by=<advisor>  older untracked links, still work

const MAP_W = 11233, MAP_H = 7946;
const L2 = { name: 'l2', width: 7200, height: 5093, cols: 8, rows: 5, tile: 1024 };

/** Close-up of the master plan around one plot, built from the sharp map tiles. */
function PlanCrop({ plot, widthPct = 9, aspect = 4 / 3, className = 'rounded-2xl', label = true }: {
  plot: Plot;
  /** How much of the map's width to show (smaller = closer). */
  widthPct?: number;
  aspect?: number;
  className?: string;
  label?: boolean;
}) {
  const [cx, cy] = centroidOf(plot);
  const rw = widthPct;
  const rh = (rw * MAP_W) / (aspect * MAP_H);
  const rx = Math.min(100 - rw, Math.max(0, cx - rw / 2));
  const ry = Math.min(100 - rh, Math.max(0, cy - rh / 2));
  const tiles: { key: string; src: string; style: React.CSSProperties }[] = [];
  for (let ty = 0; ty < L2.rows; ty++) {
    for (let tx = 0; tx < L2.cols; tx++) {
      const left = (tx * L2.tile * 100) / L2.width, top = (ty * L2.tile * 100) / L2.height;
      const right = Math.min(100, ((tx + 1) * L2.tile * 100) / L2.width), bottom = Math.min(100, ((ty + 1) * L2.tile * 100) / L2.height);
      if (right < rx || left > rx + rw || bottom < ry || top > ry + rh) continue;
      tiles.push({
        key: `${tx}-${ty}`,
        src: `/master-plan/${L2.name}/${tx}_${ty}.webp`,
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
          fill="#d4a548"
          fillOpacity={0.5}
          stroke="#9a6b12"
          strokeWidth={3.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      {label && (
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold text-gray-800 shadow">
          <MapPin className="h-3.5 w-3.5 text-[#a8884f]" /> Plot {plot.plotNo}
        </div>
      )}
    </div>
  );
}

type Loaded = { plot: Plot; buyerName?: string; senderName?: string; senderId?: string | null };

export default function PublicPlotPage({ plotId, linkId, buyerName, senderName }: { plotId?: string; linkId?: string; buyerName?: string; senderName?: string }) {
  const [state, setState] = useState<Loaded | 'loading' | 'missing'>(() => {
    if (linkId) return 'loading';
    const plot = plotId ? findPlot(plotId) : undefined;
    return plot ? { plot, buyerName, senderName } : 'missing';
  });
  const [showcase, setShowcase] = useState<Showcase>({});
  const [video, setVideo] = useState(false);

  useEffect(() => {
    void loadPublicShowcase().then(setShowcase);
    if (!linkId) return;
    void openQuote(linkId).then((q) => {
      const plot = q ? findPlot(q.plot_id) : undefined;
      setState(plot && q ? { plot, buyerName: q.buyer_name ?? undefined, senderName: q.sender_name ?? undefined, senderId: q.sender_id } : 'missing');
    });
  }, [linkId]);

  useEffect(() => {
    if (typeof state === 'object') document.title = `${state.buyerName ? `For ${state.buyerName} · ` : ''}Plot ${state.plot.plotNo} · Zion Hills Golf County`;
  }, [state]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#13261c]">
        <div className="font-lux text-2xl tracking-[0.3em] text-[#e9dcc0] animate-pulse">ZION HILLS</div>
      </div>
    );
  }
  if (state === 'missing') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f6f2ea] p-6 text-center">
        <div>
          <div className="font-lux text-3xl tracking-[0.25em] text-[#13261c]">ZION HILLS</div>
          <p className="mt-3 text-sm text-gray-500">This link is no longer valid. Please contact your Zion Hills host.</p>
        </div>
      </div>
    );
  }

  const { plot, buyerName: buyer, senderName: sender, senderId } = state;
  const render = renderFor(showcase, plot.id, plot.bedrooms);
  const view = viewFor(showcase, plot.id);
  const host: HostCard | undefined = senderId ? showcase.hosts?.[senderId] : undefined;
  const available = plot.status === 'Available';
  const k = plot.cost;
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-[100dvh] bg-[#f6f2ea] text-[#1d2a22] print:bg-white">
      {/* Hero — the home they could own */}
      <header className="relative h-[100svh] min-h-[520px] overflow-hidden bg-[#13261c] print:h-auto print:min-h-0">
        {render ? (
          <img src={render} alt={`Villa at plot ${plot.plotNo}`} className="absolute inset-0 h-full w-full object-cover animate-hero-zoom print:static print:h-72" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="h-full min-w-full animate-hero-zoom" style={{ aspectRatio: '3 / 4' }}>
              <PlanCrop plot={plot} widthPct={6} aspect={3 / 4} className="h-full" label={false} />
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/75" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-white sm:px-10">
          <div className="font-lux text-xl tracking-[0.3em]">ZION HILLS</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">Golf County</div>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-6 pb-14 text-white sm:px-10 sm:pb-16">
          <div className="mx-auto max-w-3xl animate-fade-up">
            <div className="text-[11px] uppercase tracking-[0.28em] text-[#e9dcc0]">{buyer ? 'A personal invitation for' : 'An invitation to'}</div>
            <h1 className="mt-2 font-lux text-5xl font-medium leading-[1.05] sm:text-7xl">{buyer || 'Zion Hills'}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-white/85">
              <span>Plot {plot.plotNo}</span>
              <span className="h-1 w-1 rounded-full bg-white/50" />
              <span>{plot.bedrooms}-bedroom golf villa</span>
              <span className="h-1 w-1 rounded-full bg-white/50" />
              <span>{plot.phase}</span>
            </div>
          </div>
        </div>
        <ChevronDown className="absolute bottom-4 left-1/2 h-6 w-6 -translate-x-1/2 animate-bounce text-white/70 print:hidden" />
      </header>

      <main className="mx-auto max-w-3xl px-6 sm:px-10">
        {/* Welcome note */}
        <section className="py-14 text-center sm:py-20">
          <p className="mx-auto max-w-xl font-lux text-2xl leading-relaxed text-[#2c3a31] sm:text-[28px]">
            Mornings on the fairway, evenings on your own terrace — a home set within a championship golf course, made for a slower, finer life.
          </p>
          <div className="mx-auto mt-8 h-px w-16 bg-[#c9a96e]" />
        </section>

        {/* The view */}
        {view && (
          <section className="pb-14 sm:pb-20">
            <SectionTitle eyebrow="From your plot" title="The view you'll wake up to" />
            <img src={view} alt={`View from plot ${plot.plotNo}`} className="mt-6 w-full rounded-2xl object-cover shadow-xl" />
          </section>
        )}

        {/* The home */}
        <section className="pb-14 sm:pb-20">
          <SectionTitle eyebrow="The residence" title={`Plot ${plot.plotNo}`} />
          <div className="mt-8 grid grid-cols-3 divide-x divide-[#d9cfbd] border-y border-[#d9cfbd] py-6 text-center">
            <Fact value={`${plot.bedrooms}`} unit="bedrooms" />
            <Fact value={Math.round(plot.landAreaSft).toLocaleString('en-IN')} unit="sq ft of land" />
            <Fact value={plot.builtUpSft.toLocaleString('en-IN')} unit="sq ft built-up" />
          </div>
          <div className="mt-8">
            <PlanCrop plot={plot} className="rounded-2xl shadow-xl" />
            <p className="mt-3 text-center text-[13px] text-[#7a7466]">Your plot, outlined in gold on the Zion Hills master plan.</p>
          </div>
        </section>

        {/* The price */}
        <section className="pb-14 sm:pb-20">
          <SectionTitle eyebrow="Your investment" title="" />
          <div className="mt-2 rounded-3xl bg-[#13261c] px-6 py-10 text-center text-white shadow-2xl sm:px-10">
            <div className="font-lux text-6xl font-medium tracking-tight sm:text-7xl">{formatCrore(k.totalCostLacs)}</div>
            <div className="mt-2 text-[13px] uppercase tracking-[0.2em] text-[#e9dcc0]">All-inclusive · with GST</div>
            {!available && (
              <p className="mx-auto mt-5 max-w-sm text-[14px] text-white/70">
                This plot is currently {SHAPE_COLORS[plot.status].label.toLowerCase()}. Your host will gladly show you similar homes.
              </p>
            )}
            <details className="group mx-auto mt-8 max-w-sm text-left">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 text-[13px] text-white/70 hover:text-white">
                See the breakdown <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <dl className="mt-4 divide-y divide-white/10 text-[14px]">
                <Line label="Land">{formatLakh(k.landCostLacs)}</Line>
                <Line label="Villa construction">{formatLakh(k.constnCostLacs)}</Line>
                <Line label="Club membership">{formatLakh(k.clubChargesLacs)}</Line>
                <Line label="Landscaping">{formatLakh(k.landscapeChargesLacs)}</Line>
                <Line label="Utilities">{formatLakh(k.utilityChargesLacs)}</Line>
                <Line label="GST">{formatLakh(k.gstLacs)}</Line>
              </dl>
            </details>
          </div>
        </section>

        {/* Owner stories */}
        {showcase.testimonial?.url && (
          <section className="pb-14 text-center sm:pb-20 print:hidden">
            <SectionTitle eyebrow="In their words" title="Life at Zion Hills" />
            <div className="mt-6 flex justify-center">
              <TestimonialButton onClick={() => setVideo(true)} dark={false} />
            </div>
          </section>
        )}

        {/* Your host */}
        {(sender || host) && (
          <section className="pb-14 sm:pb-20">
            <div className="flex flex-col items-center rounded-3xl bg-white px-6 py-8 text-center shadow-sm ring-1 ring-[#e7dfd0] sm:flex-row sm:gap-6 sm:text-left">
              {host?.photo ? (
                <img src={host.photo} alt={sender ?? 'Your host'} className="h-24 w-24 shrink-0 rounded-full object-cover ring-4 ring-[#f6f2ea]" />
              ) : (
                <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-[#13261c] font-lux text-4xl text-[#e9dcc0]">{(sender ?? 'Z').charAt(0)}</div>
              )}
              <div className="mt-4 flex-1 sm:mt-0">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#a8884f]">Your host</div>
                <div className="font-lux text-3xl">{sender ?? 'Zion Hills'}</div>
                {host?.title && <div className="text-[14px] text-[#7a7466]">{host.title}</div>}
                {host?.phone && (
                  <div className="mt-4 flex justify-center gap-2 sm:justify-start print:hidden">
                    <a href={`tel:${host.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 rounded-full bg-[#13261c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d3a2a]">
                      <Phone className="h-4 w-4" /> Call
                    </a>
                    <a href={`https://wa.me/${waDigits(host.phone)}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-[#13261c]/20 px-5 py-2.5 text-sm font-semibold text-[#13261c] hover:bg-[#13261c]/5">
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  </div>
                )}
                {host?.phone && <div className="mt-2 hidden text-sm print:block">{host.phone}</div>}
              </div>
            </div>
          </section>
        )}

        <footer className="border-t border-[#d9cfbd] pb-12 pt-8 text-center">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-[#13261c]/20 px-5 py-2.5 text-sm font-semibold text-[#13261c] hover:bg-[#13261c]/5 print:hidden">
            <Download className="h-4 w-4" /> Save as PDF
          </button>
          <p className="mx-auto mt-6 max-w-md text-[12px] leading-relaxed text-[#9a9384]">
            Prepared on {today}. Prices are indicative and subject to change; the final price is as per the sale agreement. Images are artist's impressions.
          </p>
          <div className="mt-6 font-lux text-lg tracking-[0.3em] text-[#13261c]">ZION HILLS</div>
        </footer>
      </main>

      {video && showcase.testimonial?.url && <VideoModal url={showcase.testimonial.url} caption={showcase.testimonial.caption} onClose={() => setVideo(false)} />}
    </div>
  );
}

function waDigits(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-[0.28em] text-[#a8884f]">{eyebrow}</div>
      {title && <h2 className="mt-2 font-lux text-4xl font-medium text-[#13261c] sm:text-5xl">{title}</h2>}
    </div>
  );
}

function Fact({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="px-2">
      <div className="font-lux text-3xl font-medium text-[#13261c] sm:text-4xl">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#7a7466] sm:text-[12px]">{unit}</div>
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-white/60">{label}</dt>
      <dd className="font-medium text-white">{children}</dd>
    </div>
  );
}
