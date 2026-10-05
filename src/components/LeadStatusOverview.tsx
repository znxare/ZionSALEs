import { useMemo, useState } from 'react';
import { Flame, Sun, Snowflake, Phone, XCircle, Ban, Users, ChevronDown } from 'lucide-react';
import type { Lead, Campaign } from '@/lib/supabase';
import { UNASSIGNED_CAMPAIGN_LABEL } from '@/lib/crm';
import Private from './Private';

const STATUS_META = [
  { label: 'Hot', color: '#ef4444', tint: 'from-red-50', icon: Flame },
  { label: 'Warm', color: '#f97316', tint: 'from-orange-50', icon: Sun },
  { label: 'Cold', color: '#0ea5e9', tint: 'from-sky-50', icon: Snowflake },
  { label: 'Calling', color: '#14b8a6', tint: 'from-teal-50', icon: Phone },
  { label: 'Dead', color: '#6b7280', tint: 'from-gray-100', icon: XCircle },
  { label: 'Junk', color: '#9ca3af', tint: 'from-gray-50', icon: Ban },
] as const;

const ORGANIC = 'organic';

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

/** Lead Status card for Campaign Analytics: status tiles, donut, distribution bar and list.
 *  Clicking a tile or a row lists that status's leads underneath. */
export default function LeadStatusOverview({ leads, campaigns }: { leads: Lead[]; campaigns: Campaign[] }) {
  const [campaignId, setCampaignId] = useState<string>('all');
  const [active, setActive] = useState<string | null>(null);

  const scoped = useMemo(() => {
    if (campaignId === 'all') return leads;
    if (campaignId === ORGANIC) return leads.filter((l) => !l.campaign_id);
    return leads.filter((l) => l.campaign_id === campaignId);
  }, [leads, campaignId]);

  const total = scoped.length;
  const segments = useMemo(
    () => STATUS_META.map((m) => ({ ...m, leads: scoped.filter((l) => l.status === m.label) })),
    [scoped],
  );
  const activeSeg = segments.find((s) => s.label === active) ?? null;
  const campaignOptions = campaigns.filter((c) => leads.some((l) => l.campaign_id === c.id));
  const hasOrganic = leads.some((l) => !l.campaign_id);

  return (
    <div className="mb-6 rounded-2xl border border-black/5 bg-white p-5 card-shadow sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-500">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold tracking-tight text-gray-900">Lead Status</h3>
            <p className="text-[13px] text-gray-500">Overview of your leads by current status</p>
          </div>
        </div>
        <div className="relative">
          <select
            value={campaignId}
            onChange={(e) => { setCampaignId(e.target.value); setActive(null); }}
            aria-label="Filter by campaign"
            className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3.5 pr-9 text-sm font-medium text-gray-700 outline-none focus:border-orange-300 sm:w-56"
          >
            <option value="all">All Campaigns</option>
            {campaignOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {hasOrganic && <option value={ORGANIC}>{UNASSIGNED_CAMPAIGN_LABEL}</option>}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Status tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {segments.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.label;
          return (
            <button
              key={s.label}
              onClick={() => setActive(isActive ? null : s.label)}
              className={`rounded-xl border border-l-4 bg-gradient-to-br ${s.tint} to-white p-4 text-left transition hover:shadow-sm ${isActive ? 'ring-2 ring-offset-1' : 'border-black/5'}`}
              style={{ borderLeftColor: s.color, ...(isActive ? { ['--tw-ring-color' as string]: s.color } : {}) }}
            >
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/80" style={{ color: s.color }}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-medium text-gray-600">{s.label}</span>
              </div>
              <div className="mt-3 font-display text-2xl font-bold text-gray-900">{s.leads.length}</div>
              <div className="mt-1 text-[12px] font-medium text-gray-500">{pct(s.leads.length, total)}%</div>
            </button>
          );
        })}
      </div>

      <div className="my-6 h-px bg-gray-100" />

      {/* Donut + distribution */}
      <div className="grid items-center gap-8 lg:grid-cols-[220px_1fr]">
        <div className="mx-auto">
          <Donut segments={segments.map((s) => ({ value: s.leads.length, color: s.color }))} total={total} />
        </div>
        <div>
          <h4 className="font-display text-base font-bold text-gray-900">Lead Distribution</h4>
          <p className="text-[12px] text-gray-500">Share of total leads by status</p>
          <div className="mt-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-gray-100">
            {segments.filter((s) => s.leads.length > 0).map((s) => (
              <div key={s.label} title={`${s.label}: ${s.leads.length}`} style={{ width: `${(s.leads.length / Math.max(total, 1)) * 100}%`, backgroundColor: s.color }} />
            ))}
          </div>
          <ul className="mt-3 divide-y divide-gray-100">
            {segments.map((s) => (
              <li key={s.label}>
                <button
                  onClick={() => setActive(active === s.label ? null : s.label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left text-sm transition hover:bg-gray-50 ${active === s.label ? 'bg-gray-50' : ''}`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 font-medium text-gray-700">{s.label}</span>
                  <span className="w-12 text-right font-semibold text-gray-900">{s.leads.length}</span>
                  <span className="w-12 text-right text-gray-500">{pct(s.leads.length, total)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Leads in the selected status */}
      {activeSeg && (
        <div className="mt-5 animate-fade-up">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900">{activeSeg.label} leads ({activeSeg.leads.length})</h4>
            <button onClick={() => setActive(null)} className="text-[12px] font-semibold text-gray-400 hover:text-gray-600">Clear</button>
          </div>
          {activeSeg.leads.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-[13px] text-gray-400">No {activeSeg.label} leads.</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {activeSeg.leads.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-gray-900">{l.name}</p>
                    <p className="text-[11px] text-gray-400"><Private>{l.phone}</Private>{l.city ? ` · ${l.city}` : ''}</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: activeSeg.color, backgroundColor: activeSeg.color + '15' }}>{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Donut({ segments, total, size = 200 }: { segments: { value: number; color: string }[]; total: number; size?: number }) {
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        {total > 0 && segments.map((s, i) => {
          if (s.value === 0) return null;
          const len = (s.value / total) * circumference;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(len - gap, 0)} ${circumference - Math.max(len - gap, 0)}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-gray-900">{total}</span>
        <span className="text-[12px] font-medium text-gray-500">Total Leads</span>
      </div>
    </div>
  );
}
