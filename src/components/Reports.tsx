import { useEffect, useMemo, useState } from 'react';
import { FileBarChart, Download, Users, TrendingUp, Megaphone, Loader2 } from 'lucide-react';
import type { Lead, Campaign, SiteVisit, ActivityType, LeadStatus } from '@/lib/supabase';
import {
  fetchActivitiesBetween, fetchAllSiteVisits, formatDate, formatDateTime, STATUSES, UNASSIGNED_CAMPAIGN_LABEL,
} from '@/lib/crm';
import { fetchHospitalityActivitiesBetween, type HospitalityLead } from '@/lib/hospitality';

type Vertical = 'all' | 'realestate' | 'hospitality';
type RangePreset = 'this_month' | 'last_month' | 'last_30' | 'last_90' | 'this_year' | 'custom';

interface Props {
  leads: Lead[];
  hospitalityLeads: HospitalityLead[];
  campaigns: Campaign[];
  onOpenCampaigns: () => void;
}

const RANGE_LABELS: Record<RangePreset, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_30: 'Last 30 days',
  last_90: 'Last 90 days',
  this_year: 'This year',
  custom: 'Custom',
};

function rangeFor(preset: RangePreset, customStart: string, customEnd: string): { start: Date; end: Date } {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const daysAgo = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
  switch (preset) {
    case 'this_month': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfToday };
    case 'last_month': return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) };
    case 'last_30': return { start: daysAgo(29), end: endOfToday };
    case 'last_90': return { start: daysAgo(89), end: endOfToday };
    case 'this_year': return { start: new Date(now.getFullYear(), 0, 1), end: endOfToday };
    case 'custom': {
      const start = customStart ? new Date(customStart + 'T00:00:00') : daysAgo(29);
      const end = customEnd ? new Date(customEnd + 'T23:59:59.999') : endOfToday;
      return { start, end };
    }
  }
}

// One activity row from either vertical, normalised for the reports.
interface ReportActivity {
  vertical: 'Real Estate' | 'Hospitality';
  leadId: string;
  type: ActivityType;
  summary: string;
  actor: string;
  created_at: string;
}

interface ReportLead {
  vertical: 'Real Estate' | 'Hospitality';
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  source: string;
  status: LeadStatus;
  campaign: string;
  assigned_to: string | null;
  next_followup_at: string | null;
  booked_at: string | null;
  created_at: string;
}

const PRODUCTIVITY_COLUMNS: { key: string; label: string; types: ActivityType[] }[] = [
  { key: 'calls', label: 'Calls', types: ['Called'] },
  { key: 'noAnswer', label: 'No answer', types: ['No Answer'] },
  { key: 'whatsapp', label: 'WhatsApp', types: ['WhatsApp Sent'] },
  { key: 'notes', label: 'Notes', types: ['Note Added'] },
  { key: 'followups', label: 'Follow-ups set', types: ['Follow-up Scheduled'] },
  { key: 'visitsSet', label: 'Visits scheduled', types: ['Site Visit Scheduled'] },
  { key: 'visitsDone', label: 'Visits done', types: ['Site Visit Completed'] },
  { key: 'sales', label: 'Sales / bookings', types: ['Sale Completed', 'Booking'] },
];

function inRange(iso: string | null, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports({ leads, hospitalityLeads, campaigns, onOpenCampaigns }: Props) {
  const [vertical, setVertical] = useState<Vertical>('all');
  const [preset, setPreset] = useState<RangePreset>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activities, setActivities] = useState<ReportActivity[]>([]);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = useMemo(() => rangeFor(preset, customStart, customEnd), [preset, customStart, customEnd]);
  const includeRE = vertical !== 'hospitality';
  const includeHosp = vertical !== 'realestate';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      includeRE ? fetchActivitiesBetween(start, end) : Promise.resolve([]),
      includeHosp ? fetchHospitalityActivitiesBetween(start, end).catch(() => []) : Promise.resolve([]),
      includeRE ? fetchAllSiteVisits() : Promise.resolve([]),
    ])
      .then(([re, hosp, sv]) => {
        if (cancelled) return;
        setActivities([
          ...re.map((a): ReportActivity => ({ vertical: 'Real Estate', leadId: a.lead_id, type: a.type, summary: a.summary, actor: a.actor_name ?? 'Unknown', created_at: a.created_at })),
          ...hosp.map((a): ReportActivity => ({ vertical: 'Hospitality', leadId: a.hospitality_lead_id, type: a.type, summary: a.summary, actor: a.actor_name ?? 'Unknown', created_at: a.created_at })),
        ]);
        setVisits(sv.filter((v) => inRange(v.scheduled_at, start, end)));
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load report data.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [start, end, includeRE, includeHosp]);

  const campaignName = useMemo(() => {
    const m = new Map(campaigns.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? '—' : UNASSIGNED_CAMPAIGN_LABEL);
  }, [campaigns]);

  const allLeads = useMemo((): ReportLead[] => [
    ...(includeRE ? leads.map((l): ReportLead => ({
      vertical: 'Real Estate', id: l.id, name: l.name, phone: l.phone, email: l.email, city: l.city, source: l.source,
      status: l.status, campaign: campaignName(l.campaign_id), assigned_to: l.assigned_to,
      next_followup_at: l.next_followup_at, booked_at: l.booked_at, created_at: l.created_at,
    })) : []),
    ...(includeHosp ? hospitalityLeads.map((l): ReportLead => ({
      vertical: 'Hospitality', id: l.id, name: l.name, phone: l.phone, email: l.email, city: l.city, source: l.source,
      status: l.status, campaign: '—', assigned_to: l.assigned_to,
      next_followup_at: l.next_followup_at, booked_at: l.booked_at, created_at: l.created_at,
    })) : []),
  ], [leads, hospitalityLeads, includeRE, includeHosp, campaignName]);

  const newLeads = useMemo(() => allLeads.filter((l) => inRange(l.created_at, start, end)), [allLeads, start, end]);

  const pipeline = useMemo(() => {
    const byStatus = STATUSES.map((s) => ({ status: s, count: newLeads.filter((l) => l.status === s).length }));
    const contactedIds = new Set(activities.filter((a) => ['Called', 'No Answer', 'WhatsApp Sent'].includes(a.type)).map((a) => a.leadId));
    const sales = allLeads.filter((l) => inRange(l.booked_at, start, end)).length;
    const visitsDone = visits.filter((v) => v.status === 'Completed').length;
    return {
      newCount: newLeads.length,
      contacted: newLeads.filter((l) => contactedIds.has(l.id)).length,
      visitsScheduled: visits.length,
      visitsDone,
      sales,
      conversion: newLeads.length > 0 ? Math.round((sales / newLeads.length) * 1000) / 10 : 0,
      byStatus,
    };
  }, [newLeads, allLeads, activities, visits, start, end]);

  const productivity = useMemo(() => {
    const byActor = new Map<string, Record<string, number>>();
    for (const a of activities) {
      if (a.type === 'Created') continue;
      const row = byActor.get(a.actor) ?? { total: 0 };
      row.total += 1;
      for (const col of PRODUCTIVITY_COLUMNS) if (col.types.includes(a.type)) row[col.key] = (row[col.key] ?? 0) + 1;
      byActor.set(a.actor, row);
    }
    return [...byActor.entries()].map(([actor, counts]) => ({ actor, counts })).sort((a, b) => b.counts.total - a.counts.total);
  }, [activities]);

  const rangeLabel = `${formatDate(start.toISOString())} – ${formatDate(end.toISOString())}`;
  const fileTag = `${vertical}_${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`;

  function exportPipeline() {
    downloadCsv(`pipeline-summary_${fileTag}.csv`, ['Metric', 'Value'], [
      ['Range', rangeLabel], ['Vertical', vertical],
      ['New leads', pipeline.newCount], ['New leads contacted', pipeline.contacted],
      ['Site visits scheduled', pipeline.visitsScheduled], ['Site visits completed', pipeline.visitsDone],
      ['Sales / bookings', pipeline.sales], ['Conversion %', pipeline.conversion],
      ...pipeline.byStatus.map((s) => [`New leads — ${s.status}`, s.count]),
    ]);
  }
  function exportProductivity() {
    downloadCsv(`team-productivity_${fileTag}.csv`, ['Team member', ...PRODUCTIVITY_COLUMNS.map((c) => c.label), 'Total actions'],
      productivity.map((p) => [p.actor, ...PRODUCTIVITY_COLUMNS.map((c) => p.counts[c.key] ?? 0), p.counts.total]));
  }
  function exportLeads() {
    downloadCsv(`leads_${fileTag}.csv`,
      ['Vertical', 'Name', 'Phone', 'Email', 'City', 'Source', 'Status', 'Campaign', 'Assigned to', 'Next follow-up', 'Booked', 'Created'],
      newLeads.map((l) => [l.vertical, l.name, l.phone, l.email, l.city, l.source, l.status, l.campaign, l.assigned_to,
        l.next_followup_at ? formatDateTime(l.next_followup_at) : '', l.booked_at ? formatDate(l.booked_at) : '', formatDateTime(l.created_at)]));
  }
  function exportActivities() {
    const names = new Map(allLeads.map((l) => [l.id, l.name]));
    downloadCsv(`activity_${fileTag}.csv`, ['When', 'Vertical', 'Team member', 'Lead', 'Type', 'Details'],
      activities.map((a) => [formatDateTime(a.created_at), a.vertical, a.actor, names.get(a.leadId) ?? '', a.type, a.summary]));
  }
  function exportVisits() {
    const names = new Map(leads.map((l) => [l.id, l.name]));
    downloadCsv(`site-visits_${fileTag}.csv`, ['Scheduled', 'Lead', 'Visit #', 'Status', 'Outcome', 'Notes'],
      visits.map((v) => [formatDateTime(v.scheduled_at), names.get(v.lead_id) ?? '', v.visit_number, v.status, v.outcome, v.notes]));
  }

  const pill = (active: boolean) => `rounded-full px-3 py-1.5 text-[12px] font-medium transition ${active ? 'brand-gradient text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-600">
          <FileBarChart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Reports</h1>
          <p className="text-[13px] text-gray-400">Pipeline, team productivity and downloads — admin only.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border border-black/5 bg-white p-4 card-shadow">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Vertical</span>
          {([['all', 'All'], ['realestate', 'Real Estate'], ['hospitality', 'Hospitality']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setVertical(v)} className={pill(vertical === v)}>{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Dates</span>
          {(Object.keys(RANGE_LABELS) as RangePreset[]).map((p) => (
            <button key={p} onClick={() => setPreset(p)} className={pill(preset === p)}>{RANGE_LABELS[p]}</button>
          ))}
          {preset === 'custom' && (
            <span className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-cyan-300" />
              <span className="text-gray-400">→</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-cyan-300" />
            </span>
          )}
        </div>
        <p className="text-[12px] text-gray-400">{rangeLabel}</p>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Pipeline summary */}
      <Card icon={TrendingUp} title="Pipeline summary" onDownload={exportPipeline}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="New leads" value={pipeline.newCount} />
          <Stat label="Contacted" value={pipeline.contacted} />
          <Stat label="Visits scheduled" value={includeRE ? pipeline.visitsScheduled : '—'} />
          <Stat label="Visits done" value={includeRE ? pipeline.visitsDone : '—'} />
          <Stat label="Sales / bookings" value={pipeline.sales} />
          <Stat label="Conversion" value={`${pipeline.conversion}%`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {pipeline.byStatus.map((s) => (
            <span key={s.status} className="rounded-full bg-gray-100 px-3 py-1 text-[12px] text-gray-600">
              {s.status} <span className="font-bold text-gray-900">{s.count}</span>
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-gray-400">New leads and their current status are counted by the date each lead was created; sales by the date they were booked.</p>
      </Card>

      {/* Team productivity */}
      <Card icon={Users} title="Team productivity" onDownload={exportProductivity}>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
        ) : productivity.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No team activity in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Team member</th>
                  {PRODUCTIVITY_COLUMNS.map((c) => <th key={c.key} className="px-2 py-2 text-right font-semibold">{c.label}</th>)}
                  <th className="py-2 pl-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productivity.map((p) => (
                  <tr key={p.actor}>
                    <td className="py-2.5 pr-3 font-semibold text-gray-900">{p.actor}</td>
                    {PRODUCTIVITY_COLUMNS.map((c) => <td key={c.key} className="px-2 py-2.5 text-right text-gray-600">{p.counts[c.key] ?? 0}</td>)}
                    <td className="py-2.5 pl-2 text-right font-bold text-gray-900">{p.counts.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[12px] text-gray-400">Counted from the activity log by who did it. Actions logged before per-user logins show as “Unknown”.</p>
      </Card>

      {/* Downloads */}
      <Card icon={Download} title="Downloads">
        <div className="grid gap-2 sm:grid-cols-3">
          <DownloadButton label="Leads" detail={`${newLeads.length} created in range`} onClick={exportLeads} />
          <DownloadButton label="Activity log" detail={loading ? 'Loading…' : `${activities.length} actions`} onClick={exportActivities} disabled={loading} />
          <DownloadButton label="Site visits" detail={includeRE ? `${visits.length} in range` : 'Real Estate only'} onClick={exportVisits} disabled={loading || !includeRE} />
        </div>
      </Card>

      {/* Campaign performance lives on its own (admin-only) page */}
      <button onClick={onOpenCampaigns} className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white p-5 text-left card-shadow transition hover:bg-gray-50">
        <span className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-gray-900">
          <Megaphone className="h-4 w-4 text-gray-400" /> Campaign performance
        </span>
        <span className="text-[13px] font-medium text-cyan-700">Open Campaigns →</span>
      </button>
    </div>
  );
}

function Card({ icon: Icon, title, onDownload, children }: { icon: typeof Users; title: string; onDownload?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-gray-900">
          <Icon className="h-4 w-4 text-gray-400" /> {title}
        </h2>
        {onDownload && (
          <button onClick={onDownload} className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 card-shadow transition hover:text-gray-900">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="font-display text-xl font-bold text-gray-900">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium text-gray-400">{label}</div>
    </div>
  );
}

function DownloadButton({ label, detail, onClick, disabled }: { label: string; detail: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50/40 disabled:opacity-50">
      <span>
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        <span className="block text-[12px] text-gray-400">{detail}</span>
      </span>
      <Download className="h-4 w-4 text-gray-400" />
    </button>
  );
}
