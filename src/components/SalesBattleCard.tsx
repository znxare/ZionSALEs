import { useMemo, useState } from 'react';
import {
  Flag, AlertTriangle, CheckCircle2, Minus, Sparkles,
  Plus, X, ChevronDown, ChevronUp, Car, ExternalLink, Search, FileText,
} from 'lucide-react';
import {
  CONDOS, VILLAS, DEFAULT_COMPETITORS, ZION_AMENITIES, AMENITY_LABELS, DRIVE_TIMES, OBJECTIONS,
  inr, inrShort, lac, type Competitor, type AmenityKey,
} from '@/lib/battleCard';
import { FAQ_ENTRIES, FAQ_CATEGORIES, type FaqEntry } from '@/lib/faq';

type Section = 'overview' | 'condos' | 'villas' | 'compare' | 'why' | 'faq' | 'objections';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'condos', label: 'Condominiums' },
  { id: 'villas', label: 'Villas' },
  { id: 'compare', label: 'Market Compare' },
  { id: 'why', label: 'Why Zion Hills' },
  { id: 'faq', label: 'FAQ' },
  { id: 'objections', label: 'Handling Objections' },
];

export default function SalesBattleCard() {
  const [section, setSection] = useState<Section>('overview');

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <Flag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Sales Battle Card</h1>
            <p className="text-[13px] text-gray-400">Zion Hills Golf County · Phase II — pricing, market comparison, and objection scripts to open on a call.</p>
          </div>
        </div>
      </div>

      {/* Under development banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600" />
        <div className="text-[13px] leading-relaxed text-amber-800">
          <span className="font-semibold">Under development — needs verification.</span> Villa and condo figures come from the official Q3 2026 pricing sheet, but Zion Hills' own amenities (spa, salon, co-working, on-site hotel, upcoming retail) are as described by the project team and aren't yet confirmed against a published source. Competitor rates, amenities, and drive times are public-listing estimates as of Aug 2026, not official builder data. Do not quote figures to a customer until sales ops has signed off.
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition ${section === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'overview' && <OverviewSection />}
      {section === 'condos' && <CondosSection />}
      {section === 'villas' && <VillasSection />}
      {section === 'compare' && <CompareSection />}
      {section === 'why' && <WhySection />}
      {section === 'faq' && <FaqSection />}
      {section === 'objections' && <ObjectionsSection />}
    </div>
  );
}

// ---------- Overview ----------

function OverviewSection() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-black/5 bg-white p-6 card-shadow">
          <h2 className="font-display text-xl font-bold leading-tight tracking-tight text-gray-900">
            Sell the <span className="text-emerald-600">fairway</span>, not just the floor plan.
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-gray-500">
            Zion Hills Phase II gives buyers more of what they pay for than most gated communities do. Open with the number below — it's the single strongest, most defensible reason to choose Zion Hills over a comparable listing.
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white card-shadow">
          <p className="text-[12px] font-medium text-emerald-100">Usable-to-saleable efficiency</p>
          <p className="mt-1 font-display text-4xl font-bold tracking-tight">81.5–92.8%</p>
          <p className="mt-1 text-[12.5px] text-emerald-100">of every saleable sq ft is space the buyer actually lives in</p>
          <p className="mt-3 text-[11px] text-emerald-200">Industry norm for premium gated communities runs ~65–72% · see Why Zion Hills</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Condominiums" value="₹1.73 Cr – 4.49 Cr" note="7 configurations · 1 BHK penthouse to 3.5 BHK duplex penthouse" />
        <StatCard label="Independent villas" value="₹4.70 Cr – 9.50 Cr+" note="3 types · 3600–5800 sft built-up on 4000–10,000+ sft plots, all-in incl. GST" />
        <StatCard label="Every unit includes" value="Club · Landscape · Utility" note="Itemized in the price — nothing sprung on the buyer post-booking" />
        <StatCard label="Smallest condo, biggest deck ratio" value="92.8%" note="The 1 BHK penthouse — private 336 sft open deck included" />
      </div>

      <div className="rounded-2xl border border-black/5 bg-amber-50/60 p-5 card-shadow">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Call opener</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-700">
          "Before we get to the number on the price sheet — the number that actually matters is this: on our smaller units, over 9 in 10 square feet you pay for is space you can stand in. Most premium communities land closer to 7 in 10. That gap is real money, every single square foot of it."
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 card-shadow">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1.5 font-display text-lg font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-[12px] leading-snug text-gray-500">{note}</p>
    </div>
  );
}

// ---------- Condominiums ----------

function CondosSection() {
  const [idx, setIdx] = useState(0);
  const c = CONDOS[idx];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {CONDOS.map((unit, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`rounded-xl border px-3 py-2 text-left text-[12.5px] font-semibold transition ${idx === i ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
          >
            {unit.name}
            <span className="block text-[10.5px] font-medium text-gray-400">{unit.floor}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
          <h3 className="font-display text-lg font-bold text-gray-900">{c.name}</h3>
          <p className="text-[12.5px] text-gray-400">{c.floor}</p>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-gray-400">Total price incl. GST</p>
          <p className="font-display text-3xl font-bold text-emerald-600">{inrShort(c.total)}</p>
          <table className="mt-4 w-full text-[13px]">
            <tbody>
              <BreakdownRow label="Price incl. GST" value={inr(c.price)} />
              <BreakdownRow label="Utility charge incl. GST" value={inr(c.utility)} dim />
              <BreakdownRow label="Landscape charge incl. GST" value={inr(c.landscape)} dim />
              <BreakdownRow label="Club charge incl. GST" value={inr(c.club)} dim />
              <BreakdownRow label="Total price incl. GST" value={inr(c.total)} total />
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Area breakdown (sft)</p>
          <div className="space-y-0.5">
            <AreaRow label="RERA carpet area" value={c.reraCarpet} />
            <AreaRow label="Carpet area" value={c.carpet} />
            <AreaRow label="Covered deck area" value={c.coveredDeck} />
            <AreaRow label="Open deck area" value={c.openDeck} />
            <AreaRow label="Useable area" value={c.useable} />
            <AreaRow label="Super built-up area" value={c.sba} />
            <AreaRow label="Saleable area" value={c.saleable} />
            <AreaRow label="Price per usable sft" value={inr(Math.round(c.total / c.useable))} isText />
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex justify-between text-[12px] text-gray-500">
              <span>Usable ÷ saleable efficiency</span>
              <span className="font-display font-bold text-amber-600">{c.ratio}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: `${c.ratio}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[10.5px] text-gray-400">
              <span>0%</span><span>Market ~69% typical</span><span>100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, dim, total }: { label: string; value: string; dim?: boolean; total?: boolean }) {
  return (
    <tr className={total ? 'border-t border-gray-300' : 'border-t border-gray-100'}>
      <td className={`py-1.5 ${dim ? 'text-gray-500' : total ? 'pt-2.5 font-bold text-gray-900' : 'text-gray-700'}`}>{label}</td>
      <td className={`py-1.5 text-right font-semibold ${total ? 'pt-2.5 text-emerald-600' : 'text-gray-800'}`}>{value}</td>
    </tr>
  );
}

function AreaRow({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="flex justify-between border-t border-gray-100 py-1.5 text-[13px] first:border-t-0">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{isText ? value : (value as number).toLocaleString('en-IN')}</span>
    </div>
  );
}

// ---------- Villas ----------

function VillasSection() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {VILLAS.map((v) => (
          <div key={v.name} className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
            <h3 className="font-display text-base font-bold text-gray-900">{v.name}</h3>
            <p className="mt-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">Total cost, incl. GST</p>
            <p className="font-display text-2xl font-bold text-emerald-600">{v.range}</p>
            <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-[12.5px]">
              <div className="flex justify-between"><span className="text-gray-500">Land area</span><span className="font-semibold text-gray-800">{v.land}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Saleable built-up area</span><span className="font-semibold text-gray-800">{v.sba}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Land rate (excl. PLC)</span><span className="font-semibold text-gray-800">{v.landRate}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Construction rate</span><span className="font-semibold text-gray-800">{v.constRate}</span></div>
            </div>
            <table className="mt-3 w-full border-t border-gray-100 pt-1 text-[12.5px]">
              <tbody>
                <BreakdownRow label="Land cost" value={v.landCost} />
                <BreakdownRow label="Construction cost" value={lac(v.constCost)} dim />
                <BreakdownRow label="Landscape cost" value={lac(v.landscapeCost)} dim />
                <BreakdownRow label="Utility charges" value={lac(v.utilityCost)} dim />
                <BreakdownRow label="Club charges" value={lac(v.clubCost)} dim />
                <BreakdownRow label="GST" value={lac(v.gst)} dim />
                <BreakdownRow label="Total cost" value={v.range} total />
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <ul className="space-y-1.5 rounded-2xl border border-black/5 bg-white p-5 text-[12.5px] leading-relaxed text-gray-500 card-shadow">
        <li>• Land rate ₹5,750/sft and construction rate ₹5,250/sft apply uniformly across all three villa types (excl. PLC).</li>
        <li>• PLC of ₹250–500/sft applies on select plots — lake-facing, green-facing, or double-side-view.</li>
        <li>• Construction cost may vary based on the actual design chosen for the plot.</li>
        <li>• FAR compensation charges apply if a smaller villa design is selected on a larger plot.</li>
      </ul>
    </div>
  );
}

// ---------- Market Compare ----------

function CompareSection() {
  const [villaIdx, setVillaIdx] = useState(0);
  const [competitors, setCompetitors] = useState<Competitor[]>(() => DEFAULT_COMPETITORS.map((c) => ({ ...c, amenities: c.amenities ? { ...c.amenities } : null })));
  const villa = VILLAS[villaIdx];
  const zionMidRupees = ((villa.lowL + villa.highL) / 2) * 100000;
  const zionRate = Math.round(zionMidRupees / villa.buaNum);

  function updateRate(i: number, rate: number) {
    setCompetitors((prev) => prev.map((c, idx) => (idx === i ? { ...c, rate } : c)));
  }
  function updateName(i: number, name: string) {
    setCompetitors((prev) => prev.map((c, idx) => (idx === i ? { ...c, name } : c)));
  }
  function removeCompetitor(i: number) {
    setCompetitors((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addCompetitor() {
    setCompetitors((prev) => [...prev, { name: '', loc: 'Add location', rate: 15000, editableName: true, amenities: null }]);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
        <h2 className="font-display text-lg font-bold text-gray-900">Let the buyer do the comparing.</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-gray-500">
          Pick the Zion Hills villa size the buyer is looking at, then show — don't argue — what the same built-up area costs at other Bangalore golf communities. Rates are editable: overwrite them if the buyer has a more current number. If they push the rate down, the gap under each row shows what Zion Hills includes that the other project doesn't advertise.
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {VILLAS.map((v, i) => (
            <button
              key={v.name}
              onClick={() => setVillaIdx(i)}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${villaIdx === i ? 'border-transparent bg-emerald-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_36px] gap-3 px-4 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 sm:grid">
          <span>Project</span><span>Rate / sft</span><span>Equiv. cost, same size</span><span>vs Zion Hills</span><span />
        </div>

        {/* Zion baseline row */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_36px] sm:items-center sm:gap-3">
            <div>
              <p className="text-[13.5px] font-bold text-gray-900">Zion Hills — {villa.name}</p>
              <p className="text-[11px] text-gray-400">Kolar Road</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Effective rate</p>
              <p className="font-semibold text-gray-900">₹{zionRate.toLocaleString('en-IN')}/sft</p>
            </div>
            <p className="font-semibold text-gray-900">{villa.range}</p>
            <span className="w-fit rounded-md bg-gray-200 px-2.5 py-1 text-[11.5px] font-bold text-gray-600">Baseline</span>
            <span />
          </div>
        </div>

        {competitors.map((c, i) => (
          <CompetitorRow
            key={i}
            competitor={c}
            villa={villa}
            zionMidRupees={zionMidRupees}
            onRateChange={(rate) => updateRate(i, rate)}
            onNameChange={(name) => updateName(i, name)}
            onRemove={c.editableName ? () => removeCompetitor(i) : undefined}
          />
        ))}

        <button
          onClick={addCompetitor}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3.5 py-2 text-[12.5px] font-semibold text-gray-500 transition hover:border-emerald-400 hover:text-emerald-600"
        >
          <Plus className="h-3.5 w-3.5" /> Add a project mentioned on the call
        </button>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-black/5 bg-amber-50/60 p-4 card-shadow">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-[13px] leading-relaxed text-gray-700">
          <span className="font-semibold text-amber-700">Sell without selling:</span> don't say "we're cheaper." Say "here's what the same square footage costs at [project the buyer mentioned]" and let them do the arithmetic. The gap is the pitch — you don't need to narrate it.
        </p>
      </div>

      <p className="rounded-2xl border border-black/5 bg-white p-4 text-[11.5px] leading-relaxed text-gray-400 card-shadow">
        Reference rates as of Aug 2026, from public listing aggregators — treat as a starting point, not a quote. Prestige Golfshire ≈ ₹13,000–20,900/sft on an ~8,120–9,905 sft villa at ₹12.92–17 Cr, with prime resale units quoted considerably higher. Prestige Augusta Golf Village ≈ ₹14,000–20,000/sft resale, ~₹10,000–17,900/sft at original launch. Eagleton Golf Village (Bidadi) resale listings imply roughly ₹8,300–13,300/sft. Amenity presence/absence is drawn from each project's own marketing and listing pages — "not advertised" means it wasn't found in public materials, not a confirmed absence. Golfshire sits ~40–45 min from central Bangalore, Augusta ~20–30 min — both meaningfully closer than Zion Hills' Kolar Road location (~60–90 min). See the Why Zion Hills tab for how to sequence that honestly on a call.
      </p>
    </div>
  );
}

function CompetitorRow({ competitor, villa, zionMidRupees, onRateChange, onNameChange, onRemove }: {
  competitor: Competitor;
  villa: (typeof VILLAS)[number];
  zionMidRupees: number;
  onRateChange: (rate: number) => void;
  onNameChange: (name: string) => void;
  onRemove?: () => void;
}) {
  const equivRupees = competitor.rate * villa.buaNum;
  const deltaPct = zionMidRupees ? Math.round(((equivRupees - zionMidRupees) / zionMidRupees) * 100) : 0;
  const deltaClass = deltaPct > 2 ? 'bg-red-50 text-red-600' : deltaPct < -2 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600';
  const emphasize = deltaPct <= 15;

  const gaps = competitor.amenities
    ? (Object.keys(ZION_AMENITIES) as AmenityKey[]).filter((k) => ZION_AMENITIES[k] && competitor.amenities?.[k] === false)
    : null;

  return (
    <div className="rounded-2xl border border-black/5 bg-white card-shadow">
      <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1.4fr_1fr_1fr_1fr_36px] sm:items-center sm:gap-3">
        <div>
          {competitor.editableName ? (
            <input
              value={competitor.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Project name"
              className="w-full border-none bg-transparent p-0 text-[13.5px] font-bold text-gray-900 outline-none placeholder:text-gray-300"
            />
          ) : (
            <p className="text-[13.5px] font-bold text-gray-900">{competitor.name}</p>
          )}
          <p className="text-[11px] text-gray-400">{competitor.loc}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Rate (editable)</p>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
            <span className="text-[12px] text-gray-400">₹</span>
            <input
              type="number"
              min={0}
              step={100}
              value={competitor.rate}
              onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
              className="w-full min-w-0 border-none bg-transparent p-0 text-[13.5px] font-bold text-gray-900 outline-none"
            />
            <span className="text-[11px] text-gray-400">/sft</span>
          </div>
        </div>
        <p className="font-semibold text-gray-900">{lac(Math.round(equivRupees / 100000))}</p>
        <span className={`w-fit rounded-md px-2.5 py-1 text-[11.5px] font-bold ${deltaClass}`}>
          {deltaPct > 0 ? '+' : ''}{deltaPct}%
        </span>
        {onRemove ? (
          <button onClick={onRemove} className="justify-self-end rounded-full p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : <span />}
      </div>
      <div className={`flex flex-wrap items-center gap-1.5 border-t border-dashed px-4 py-2.5 ${emphasize ? 'border-amber-200 bg-amber-50/60' : 'border-gray-100'}`}>
        {gaps === null ? (
          <span className="text-[11.5px] italic text-gray-400">Ask what's included at this rate: golf course, clubhouse, spa, restaurant, co-working, on-site hospitality, retail.</span>
        ) : gaps.length === 0 ? (
          <span className="text-[11.5px] italic text-gray-400">Comparable on advertised amenities — the price gap is the argument here.</span>
        ) : (
          <>
            <span className="mr-1 text-[11px] font-semibold text-gray-400">Zion Hills also gives you, this doesn't:</span>
            {gaps.map((g) => (
              <span key={g} className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{AMENITY_LABELS[g]}</span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Why Zion Hills ----------

const USPS = [
  { n: '01', title: 'You pay for less air', body: '81.5–92.8% of saleable area is carpet + deck the buyer actually uses. Super built-up padding (shared walls, common areas) is the smallest slice on the sheet, not the biggest.' },
  { n: '02', title: 'Nothing hidden past booking', body: 'Utility, landscape, and club charges are itemized per unit up front, all inclusive of GST. The total price on the sheet is the number the buyer actually pays.' },
  { n: '03', title: 'A configuration for every buyer', body: 'Seven condo layouts from a 1 BHK penthouse to a 3.5 BHK duplex, plus three villa sizes from 3600 to 5800 sft built-up — one community, multiple entry points.' },
  { n: '04', title: "Outdoor space isn't an afterthought", body: 'Every condo carries a covered deck (78–631 sft); the 1 BHK penthouse adds a 336 sft private open deck on top. Villas sit on 4000–10,000+ sft plots with golf-facing PLC options.' },
];

const LADDER = [
  { n: '01', title: 'Open on the clubhouse, not the commute', body: 'Golf course, spa, salon, restaurant, bar, co-working, on-site hospitality — the same category of amenity as a five-star golf resort, itemized in the amenities table below. Let them place Zion Hills next to Golfshire and Augusta in their head before price ever comes up.' },
  { n: '02', title: 'Then show the price gap, same size', body: 'Use the Market Compare tab live: same built-up area costs 15–20%+ more at Golfshire or Augusta. That\'s not a discount story — it\'s "you\'re getting the category for less," which lands very differently.' },
  { n: '03', title: 'Back it with the efficiency and transparency numbers', body: '81–93% usable-to-saleable efficiency and a fully itemized price sheet — proof this isn\'t a lower price because something\'s been cut, it\'s a lower price with the same or better fundamentals.' },
  { n: '04', title: 'Only now, address the drive', body: 'Acknowledge it plainly, then give it context: golf communities need land no inner suburb has, so every serious option in this category is a drive out — Golfshire and Augusta just happen to sit on corridors that got their infrastructure investment first. The Satellite Town Ring Road, connecting Kolar Road and due to open in phases through late 2026, is Kolar\'s version of that same investment, arriving now rather than a decade ago.' },
];

const AMENITY_COLUMNS: { key: string; label: string; amenities: Record<AmenityKey, boolean | 'upcoming'> }[] = [
  { key: 'zion', label: 'Zion Hills', amenities: ZION_AMENITIES },
  { key: 'golfshire', label: 'Prestige Golfshire', amenities: { golf: true, clubhouse: true, spa: true, salon: false, restaurant: true, coworking: false, hotel: true, retail: false } },
  { key: 'augusta', label: 'Prestige Augusta', amenities: { golf: true, clubhouse: true, spa: false, salon: false, restaurant: true, coworking: false, hotel: false, retail: false } },
  { key: 'eagleton', label: 'Eagleton Golf Village', amenities: { golf: true, clubhouse: true, spa: false, salon: false, restaurant: false, coworking: false, hotel: true, retail: false } },
];

function WhySection() {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">The pitch, in four parts</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {USPS.map((u) => (
            <div key={u.n} className="rounded-2xl border border-black/5 bg-white p-4 card-shadow">
              <p className="font-display text-[12px] font-bold text-amber-600">{u.n}</p>
              <h3 className="mt-1.5 text-[14px] font-bold text-gray-900">{u.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500">{u.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Efficiency comparison</p>
        <EfficiencyBar label="Zion Hills" value="81–93%" pct={87} highlight />
        <EfficiencyBar label="Typical market" value="~65–72%" pct={68} />
        <p className="mt-3 text-[11.5px] leading-relaxed text-gray-400">"Typical market" reflects the commonly cited usable-to-saleable range for premium gated communities in India, not a specific named competitor. Swap in an actual competitor's brochure numbers if the buyer names one on the call.</p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
        <h2 className="font-display text-lg font-bold text-gray-900">A golf community isn't priced like a flat.</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-gray-500">
          Weighing Zion Hills against an ordinary city apartment was never a fair comparison. The comparison that's actually fair is against the other golf-anchored communities in and around Bangalore. Here's how the clubhouse offering stacks up.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-gray-100 text-[10.5px] uppercase tracking-wide text-gray-400">
                <th className="py-2 font-semibold">Amenity</th>
                {AMENITY_COLUMNS.map((col) => (
                  <th key={col.key} className={`py-2 text-center font-semibold ${col.key === 'zion' ? 'text-emerald-700' : ''}`}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(AMENITY_LABELS) as AmenityKey[]).map((k) => (
                <tr key={k} className="border-b border-gray-50">
                  <td className="py-2 font-semibold text-gray-800">{AMENITY_LABELS[k]}</td>
                  {AMENITY_COLUMNS.map((col) => (
                    <td key={col.key} className={`py-2 text-center ${col.key === 'zion' ? 'bg-emerald-50/50' : ''}`}>
                      <AmenityMark v={col.amenities[k]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-gray-400">
          Zion Hills column reflects the project team's own description, not yet on public listing sites — say so if a buyer asks. Competitor columns are what's published on each project's official or listing pages as of Aug 2026; a dash means not advertised, not confirmed absent. Golfshire's on-site hotel is a JW Marriott — a genuinely bigger hospitality asset than a typical clubhouse hotel; don't undersell it if a buyer already knows Golfshire. The honest pitch isn't "we have more," it's "we match the category on the essentials, add co-working and salon that the others don't advertise, and do it below their price."
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
        <h2 className="font-display text-lg font-bold text-gray-900">Make location the last thing they weigh, not the first.</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-gray-500">
          Kolar is genuinely farther out than Golfshire or Augusta — don't dodge that if it comes up early. Walk the amenities and price first, so by the time location comes up, it's a trade-off being weighed against a value they've already agreed is real.
        </p>
        <ol className="mt-4 divide-y divide-gray-100">
          {LADDER.map((l) => (
            <li key={l.n} className="grid grid-cols-[26px_1fr] gap-3 py-3 first:pt-0 last:pb-0">
              <span className="font-display text-[15px] font-bold text-amber-600">{l.n}</span>
              <div>
                <p className="text-[13.5px] font-bold text-gray-900">{l.title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-gray-500">{l.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <table className="mt-4 w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10.5px] uppercase tracking-wide text-gray-400">
              <th className="py-2 font-semibold">Project</th>
              <th className="py-2 text-right font-semibold">Approx. drive from central Bangalore</th>
            </tr>
          </thead>
          <tbody>
            {DRIVE_TIMES.map((d) => (
              <tr key={d.name} className="border-b border-gray-50">
                <td className={`flex items-center gap-1.5 py-2 ${d.isZion ? 'font-bold text-emerald-700' : 'text-gray-700'}`}>
                  <Car className="h-3.5 w-3.5 text-gray-300" /> {d.name} <span className="text-[11px] font-normal text-gray-400">({d.loc})</span>
                </td>
                <td className={`py-2 text-right font-semibold ${d.isZion ? 'text-emerald-700' : 'text-gray-700'}`}>{d.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11.5px] leading-relaxed text-gray-400">
          Drive times are approximate, traffic-dependent public estimates (Aug 2026) — confirm current conditions before quoting a number to a buyer. The Satellite Town Ring Road's first 144 km operational corridor, linking Kolar Road to Devanahalli, Hoskote, and the airport, is targeted for completion by November 2026 per NHAI statements.
        </p>
      </div>

      <div className="rounded-2xl border-l-4 border-emerald-600 border-y border-r border-black/5 bg-white p-5 card-shadow">
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-emerald-600">For the sales manager — why this price holds up</p>
        <p className="text-[13px] leading-relaxed text-gray-700">
          Zion Hills prices its villas 15–22% below Prestige Golfshire and Augusta at the same built-up area, while matching or exceeding both on clubhouse amenities and running a materially higher usable-to-saleable ratio than the category norm. The only place it doesn't win outright is drive time from central Bangalore — a real, disclosed trade-off, not a hidden one, and one with a dated infrastructure fix (STRR) already under construction. That's a defensible price: not cheap because something was cut, cheap because the land and construction cost less this far out, passed through transparently on an itemized sheet.
        </p>
      </div>
    </div>
  );
}

function AmenityMark({ v }: { v: boolean | 'upcoming' | undefined }) {
  if (v === true) return <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />;
  if (v === 'upcoming') return <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-amber-600"><Sparkles className="h-3 w-3" />Soon</span>;
  return <Minus className="mx-auto h-3.5 w-3.5 text-gray-300" />;
}

function EfficiencyBar({ label, value, pct, highlight }: { label: string; value: string; pct: number; highlight?: boolean }) {
  return (
    <div className="mb-3 grid grid-cols-[120px_1fr_70px] items-center gap-3 last:mb-0">
      <span className="text-[12.5px] font-semibold text-gray-700">{label}</span>
      <div className="h-4 overflow-hidden rounded-md bg-gray-100">
        <div className={`h-full rounded-md ${highlight ? 'bg-gradient-to-r from-amber-400 to-emerald-500' : 'bg-gray-300'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-right text-[12.5px] font-bold text-gray-800">{value}</span>
    </div>
  );
}

// ---------- FAQ ----------

const SOURCE_LABEL: Record<FaqEntry['source'], string> = {
  'construction-agreement': 'Construction Agreement',
  'faq-2022': '2022 Call Script',
  both: 'Both sources',
};
const SOURCE_TINT: Record<FaqEntry['source'], string> = {
  'construction-agreement': 'bg-emerald-50 text-emerald-700',
  'faq-2022': 'bg-amber-50 text-amber-700',
  both: 'bg-violet-50 text-violet-700',
};

function FaqSection() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? FAQ_ENTRIES.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q) || f.category.toLowerCase().includes(q))
      : FAQ_ENTRIES;
    const byCategory = new Map<string, FaqEntry[]>();
    FAQ_CATEGORIES.forEach((c) => byCategory.set(c, []));
    filtered.forEach((f) => byCategory.get(f.category)?.push(f));
    return byCategory;
  }, [query]);

  const totalResults = Array.from(results.values()).reduce((s, arr) => s + arr.length, 0);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-2xl border border-black/5 bg-amber-50/60 p-4 card-shadow">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-[12.5px] leading-relaxed text-gray-700">
          Sourced from the Phase II Construction Agreement (Mar 2025 draft) and an internal 2022 call-handling script. The 2022 document contained several unresolved, contradicting figures (green fees, completion dates, home counts) — those were left out rather than guessed. Draft terms may change before final execution; confirm anything commercial or legal with sales ops before quoting.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions — e.g. warranty, payment, flooring, location…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-300"
        />
      </div>

      <p className="text-[11.5px] text-gray-400">{totalResults} {totalResults === 1 ? 'question' : 'questions'}{query && ` matching "${query}"`}</p>

      {totalResults === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-white p-8 text-center text-sm text-gray-400 card-shadow">
          No questions match "{query}". Try a different word.
        </div>
      ) : (
        <div className="space-y-6">
          {FAQ_CATEGORIES.map((cat) => {
            const entries = results.get(cat) ?? [];
            if (entries.length === 0) return null;
            return (
              <div key={cat}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{cat}</p>
                <div className="space-y-2">
                  {entries.map((f) => {
                    const isOpen = open.has(f.id);
                    return (
                      <div key={f.id} className="overflow-hidden rounded-2xl border border-black/5 bg-white card-shadow">
                        <button
                          onClick={() => toggle(f.id)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                          <span className="text-[13px] font-semibold text-gray-900">{f.q}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${SOURCE_TINT[f.source]}`}>{SOURCE_LABEL[f.source]}</span>
                            {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                          </span>
                        </button>
                        {isOpen && <p className="px-4 pb-3.5 text-[12.5px] leading-relaxed text-gray-500">{f.a}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Objections ----------

function ObjectionsSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-2.5">
      {OBJECTIONS.map((o, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="overflow-hidden rounded-2xl border border-black/5 bg-white card-shadow">
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
            >
              <span className="text-[13.5px] font-semibold text-gray-900">{o.q}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{o.tag}</span>
                {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </span>
            </button>
            {isOpen && (
              <p className="max-w-3xl px-5 pb-4 text-[13px] leading-relaxed text-gray-500">{o.a}</p>
            )}
          </div>
        );
      })}

      <p className="flex items-center gap-1.5 pt-2 text-[11px] text-gray-400">
        <ExternalLink className="h-3 w-3" /> Full pricing sheet and market research live in the standalone battle card artifact — ask sales ops for the link if this page is missing something.
      </p>
    </div>
  );
}
