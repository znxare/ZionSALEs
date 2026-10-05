import { useEffect, useRef, useState } from 'react';
import { Sparkles, Upload, Trash2, Loader2, Film, Link2, Contact, MapPin, Plus } from 'lucide-react';
import type { Profile } from '@/lib/supabase';
import { SAMPLE_PLOTS } from '@/lib/inventory';
import { loadShowcase, updateShowcase, uploadShowcaseFile, type Showcase, type HostCard, type TourStop } from '@/lib/showcase';
import { loadCalibration } from '@/lib/tour';
import { VideoModal } from './ShowcaseMedia';

// Settings → what buyers see: renders, the owner video, host cards and the
// pictures that pop up at tour stops.

function Card({ icon: Icon, title, hint, children }: { icon: typeof Sparkles; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
      <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-gray-900">
        <Icon className="h-4 w-4 text-gray-400" /> {title}
      </h2>
      {hint && <p className="mt-1 text-[12.5px] text-gray-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** One picture/video slot: preview, upload, remove. */
function MediaSlot({ label, url, accept = 'image/*', folder, onChange, round }: {
  label: string;
  url?: string;
  accept?: string;
  folder: string;
  onChange: (url: string | undefined) => Promise<void>;
  round?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isVideo = !!url && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setErr(null);
    try { await onChange(await uploadShowcaseFile(file, folder)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }

  return (
    <div className="flex items-center gap-3">
      <div className={`grid h-14 shrink-0 place-items-center overflow-hidden bg-gray-100 text-gray-300 ${round ? 'w-14 rounded-full' : 'w-20 rounded-xl'}`}>
        {url ? (isVideo ? <Film className="h-5 w-5 text-gray-500" /> : <img src={url} alt="" className="h-full w-full object-cover" />) : <Upload className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-gray-800">{label}</div>
        {err ? <div className="text-[12px] text-red-600">{err}</div> : <div className="text-[12px] text-gray-400">{url ? 'Added' : 'Not added yet'}</div>}
      </div>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      <button onClick={() => input.current?.click()} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {url ? 'Replace' : 'Upload'}
      </button>
      {url && (
        <button onClick={() => void onChange(undefined)} title="Remove" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function useShowcase() {
  const [s, setS] = useState<Showcase | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void loadShowcase().then(setS); }, []);
  async function update(change: (s: Showcase) => Showcase) {
    setErr(null);
    try { setS(await updateShowcase(change)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); throw e; }
  }
  return { s, err, update };
}

/** Everyone: how you appear to buyers on their invitation page. */
export function MyHostCard({ userId }: { userId: string }) {
  const { s, err, update } = useShowcase();
  const card: HostCard = s?.hosts?.[userId] ?? {};
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { setPhone(card.phone ?? ''); setTitle(card.title ?? ''); }, [card.phone, card.title]);

  const setCard = (patch: Partial<HostCard>) => update((cur) => ({ ...cur, hosts: { ...cur.hosts, [userId]: { ...cur.hosts?.[userId], ...patch } } }));

  if (!s) return null;
  return (
    <Card icon={Contact} title="My host card" hint="Shown to buyers on the quotes you send: your photo, title and direct number.">
      <div className="space-y-4">
        <MediaSlot label="Your photo" url={card.photo} folder="hosts" round onChange={(photo) => setCard({ photo }).catch(() => {})} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Senior Sales Advisor" className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-300" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Direct number for buyers" className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-300" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void setCard({ phone: phone.trim() || undefined, title: title.trim() || undefined }).then(() => { setSaved(true); window.setTimeout(() => setSaved(false), 2000); }).catch(() => {})}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Save
          </button>
          {saved && <span className="text-[13px] font-medium text-emerald-600">Saved</span>}
          {err && <span className="text-[13px] text-red-600">{err}</span>}
        </div>
      </div>
    </Card>
  );
}

/** Admin: everything buyers see. */
export function BuyerShowcaseSettings({ profiles }: { profiles: Profile[] }) {
  const { s, err, update } = useShowcase();
  const [videoLink, setVideoLink] = useState('');
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState(false);
  const [plotQuery, setPlotQuery] = useState('');
  useEffect(() => { setVideoLink(s?.testimonial?.url ?? ''); setCaption(s?.testimonial?.caption ?? ''); }, [s?.testimonial?.url, s?.testimonial?.caption]);

  if (!s) return null;
  const save = (change: (s: Showcase) => Showcase) => update(change).catch(() => {});
  const setPlot = (id: string, patch: { render?: string; view?: string }) =>
    save((cur) => ({ ...cur, plots: { ...cur.plots, [id]: { ...cur.plots?.[id], ...patch } } }));
  const plots = SAMPLE_PLOTS.filter((p) => !plotQuery.trim() || p.plotNo.includes(plotQuery.trim()));

  return (
    <div className="space-y-5">
      {err && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

      <Card icon={Sparkles} title="Buyer showcase" hint="What buyers see in the personal welcome on the iPad and on their invitation page.">
        <div className="space-y-4">
          <MediaSlot label="Welcome picture (behind “Welcome to Zion Hills”)" url={s.welcomeImage} folder="welcome" onChange={(welcomeImage) => save((c) => ({ ...c, welcomeImage }))} />
          <MediaSlot label="3BHK villa render (used for every 3BHK plot)" url={s.villaRenders?.[3]} folder="renders" onChange={(u) => save((c) => ({ ...c, villaRenders: { ...c.villaRenders, 3: u } }))} />
          <MediaSlot label="4BHK villa render (used for every 4BHK plot)" url={s.villaRenders?.[4]} folder="renders" onChange={(u) => save((c) => ({ ...c, villaRenders: { ...c.villaRenders, 4: u } }))} />
        </div>
      </Card>

      <Card icon={Film} title="Owner testimonial video" hint="Upload a video (up to 50 MB), or paste a YouTube or Google Drive link for longer ones.">
        <div className="space-y-3">
          <MediaSlot label="Upload a video" url={s.testimonial?.url && !/youtu|drive\.google/.test(s.testimonial.url) ? s.testimonial.url : undefined} accept="video/*" folder="videos"
            onChange={(url) => save((c) => ({ ...c, testimonial: url ? { url, caption: c.testimonial?.caption } : undefined }))} />
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-gray-400" />
            <input value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="…or paste a YouTube / Drive link" className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-300" />
          </div>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption, e.g. “The Mehtas, owners since 2024”" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-300" />
          <div className="flex gap-2">
            <button
              onClick={() => void save((c) => ({ ...c, testimonial: videoLink.trim() ? { url: videoLink.trim(), caption: caption.trim() || undefined } : undefined }))}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Save video
            </button>
            {s.testimonial?.url && <button onClick={() => setPreview(true)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Preview</button>}
          </div>
        </div>
      </Card>

      <Card icon={Sparkles} title="Plot pictures" hint="Optional, per plot: its own render (replaces the villa render above) and a photo of the view from the plot.">
        <input value={plotQuery} onChange={(e) => setPlotQuery(e.target.value)} placeholder="Find plot number" className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-300" />
        <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
          {plots.map((p) => (
            <div key={p.id} className="rounded-xl bg-gray-50 p-3">
              <div className="mb-2 text-[13px] font-bold text-gray-900">Plot {p.plotNo} <span className="font-normal text-gray-400">· {p.bedrooms}BHK</span></div>
              <div className="space-y-2">
                <MediaSlot label="Render of this home" url={s.plots?.[p.id]?.render} folder="renders" onChange={(render) => setPlot(p.id, { render })} />
                <MediaSlot label="View from the plot" url={s.plots?.[p.id]?.view} folder="views" onChange={(view) => setPlot(p.id, { view })} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <TourStopsSettings stops={s.stops ?? []} onChange={(stops) => save((c) => ({ ...c, stops }))} />

      <Card icon={Contact} title="Host cards" hint="Each person can set their own in Settings → My host card. You can fill them in here too.">
        <div className="space-y-3">
          {profiles.map((pr) => (
            <MediaSlot key={pr.id} label={`${pr.full_name}${s.hosts?.[pr.id]?.phone ? ` · ${s.hosts[pr.id].phone}` : ''}`} url={s.hosts?.[pr.id]?.photo} folder="hosts" round
              onChange={(photo) => save((c) => ({ ...c, hosts: { ...c.hosts, [pr.id]: { ...c.hosts?.[pr.id], photo } } }))} />
          ))}
        </div>
      </Card>

      {preview && s.testimonial?.url && <VideoModal url={s.testimonial.url} caption={s.testimonial.caption} onClose={() => setPreview(false)} />}
    </div>
  );
}

/** Pictures that pop up on the iPad when the cart reaches a spot. Uses the named calibration spots. */
function TourStopsSettings({ stops, onChange }: { stops: TourStop[]; onChange: (s: TourStop[]) => Promise<void> }) {
  const [spots, setSpots] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [pick, setPick] = useState('');
  useEffect(() => {
    void loadCalibration().then((c) => setSpots(c ? c.points.filter((p) => p.label).map((p) => ({ label: p.label!, lat: p.lat, lng: p.lng })) : []));
  }, []);

  const unused = spots.filter((sp) => !stops.some((st) => st.label === sp.label));
  const setStop = (id: string, patch: Partial<TourStop>) => onChange(stops.map((st) => (st.id === id ? { ...st, ...patch } : st)));

  return (
    <Card icon={MapPin} title="Tour stops" hint="Pick a named spot from your calibration ride and add a picture. It pops up on the iPad when the cart gets close.">
      <div className="space-y-3">
        {stops.map((st) => (
          <div key={st.id} className="rounded-xl bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[13px] font-bold text-gray-900">{st.label}</div>
              <div className="flex items-center gap-2">
                <select value={st.radiusM} onChange={(e) => void setStop(st.id, { radiusM: Number(e.target.value) })} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[12px]">
                  {[20, 30, 50, 80].map((r) => <option key={r} value={r}>within {r} m</option>)}
                </select>
                <button onClick={() => void onChange(stops.filter((x) => x.id !== st.id))} title="Remove stop" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <MediaSlot label="Picture" url={st.image || undefined} folder="stops" onChange={(image) => setStop(st.id, { image: image ?? '' })} />
            <input
              defaultValue={st.caption ?? ''}
              onBlur={(e) => { if (e.target.value !== (st.caption ?? '')) void setStop(st.id, { caption: e.target.value.trim() || undefined }); }}
              placeholder="Caption, e.g. “The clubhouse — opening 2027”"
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] outline-none focus:border-orange-300"
            />
          </div>
        ))}
        {spots.length === 0 ? (
          <p className="text-[13px] text-gray-400">No named spots saved for the team yet — record them on a calibration ride and Save for team.</p>
        ) : unused.length > 0 && (
          <div className="flex gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
              <option value="">Choose a spot…</option>
              {unused.map((sp) => <option key={sp.label} value={sp.label}>{sp.label}</option>)}
            </select>
            <button
              disabled={!pick}
              onClick={() => {
                const sp = spots.find((x) => x.label === pick);
                if (!sp) return;
                void onChange([...stops, { id: `${Date.now()}`, label: sp.label, lat: sp.lat, lng: sp.lng, radiusM: 30, image: '' }]);
                setPick('');
              }}
              className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Add stop
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
