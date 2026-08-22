import { useState, useMemo, useEffect } from 'react';
import {
  CalendarClock, CheckCircle2, MapPin, TrendingUp, Users, Repeat,
  Search, Download, BarChart3, Table as TableIcon, Calendar,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import type { Lead, Campaign, SiteVisit } from '@/lib/supabase';
import {
  fetchAllSiteVisits, formatDate, formatTime, formatDateTime, isToday, isThisWeek, isThisMonth,
} from '@/lib/crm';
import { BarChart, DonutChart } from './charts';

type ViewMode = 'list' | 'analytics' | 'calendar';
type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom' | 'all';

interface Props {
  leads: Lead[];
  campaigns: Campaign[];
  onOpenLead: (id: string) => void;
}

const CHART_COLORS = ['#1f6f43', '#c9a227', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

function getRange(preset: DateRangePreset, customStart: string, customEnd: string): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': { const y = new Date(now); y.setDate(y.getDate() - 1); return { start: startOfDay(y), end: endOfDay(y) }; }
    case 'this_week': {
      const sow = new Date(now); sow.setDate(sow.getDate() - ((sow.getDay() + 6) % 7)); sow.setHours(0, 0, 0, 0);
      const eow = new Date(sow); eow.setDate(eow.getDate() + 7);
      return { start: sow, end: eow };
    }
    case 'last_week': {
      const sow = new Date(now); sow.setDate(sow.getDate() - ((sow.getDay() + 6) % 7) - 7); sow.setHours(0, 0, 0, 0);
      const eow = new Date(sow); eow.setDate(eow.getDate() + 7);
      return { start: sow, end: eow };
    }
    case 'this_month': { const s = new Date(now.getFullYear(), now.getMonth(), 1); const e = new Date(now.getFullYear(), now.getMonth() + 1, 1); return { start: s, end: e }; }
    case 'last_month': { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 1); return { start: s, end: e }; }
    case 'custom': { const s = customStart ? new Date(customStart) : new Date(0); const e = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now); return { start: s, end: e }; }
    default: return { start: new Date(0), end: endOfDay(now) };
  }
}

export default function SiteVisits({ leads, campaigns, onOpenLead }: Props) {
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  async function load() {
    try {
      setLoading(true);
      const data = await fetchAllSiteVisits();
      setVisits(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const leadMap = useMemo(() => {
    const m = new Map<string, Lead>();
    leads.forEach((l) => m.set(l.id, l));
    return m;
  }, [leads]);

  const campaignMap = useMemo(() => {
    const m = new Map<string, Campaign>();
    campaigns.forEach((c) => m.set(c.id, c));
    return m;
  }, [campaigns]);

  const range = useMemo(() => getRange(rangePreset, customStart, customEnd), [rangePreset, customStart, customEnd]);

  // Visits within selected date range
  const rangedVisits = useMemo(() => {
    return visits.filter((v) => {
      const d = new Date(v.scheduled_at);
      return d >= range.start && d <= range.end;
    });
  }, [visits, range]);

  // KPI cards (all-time)
  const kpis = useMemo(() => {
    const today = visits.filter((v) => isToday(v.scheduled_at));
    const week = visits.filter((v) => isThisWeek(v.scheduled_at));
    const month = visits.filter((v) => isThisMonth(v.scheduled_at));
    const uniqueProspects = new Set(visits.map((v) => v.lead_id)).size;
    const avg = uniqueProspects > 0 ? (visits.length / uniqueProspects).toFixed(1) : '0';
    return { today: today.length, week: week.length, month: month.length, total: visits.length, avg };
  }, [visits]);

  // Date range KPIs
  const rangeKpis = useMemo(() => {
    const total = rangedVisits.length;
    const uniqueProspects = new Set(rangedVisits.map((v) => v.lead_id)).size;
    const repeatProspects = new Set<string>();
    const counts = new Map<string, number>();
    rangedVisits.forEach((v) => { const c = (counts.get(v.lead_id) ?? 0) + 1; counts.set(v.lead_id, c); if (c > 1) repeatProspects.add(v.lead_id); });
    const avg = uniqueProspects > 0 ? (total / uniqueProspects).toFixed(1) : '0';
    return { total, uniqueProspects, repeat: repeatProspects.size, avg };
  }, [rangedVisits]);

  // Prospects table (within range)
  const prospects = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byLead = new Map<string, SiteVisit[]>();
    rangedVisits.forEach((v) => {
      if (!byLead.has(v.lead_id)) byLead.set(v.lead_id, []);
      byLead.get(v.lead_id)!.push(v);
    });
    const rows = [...byLead.entries()].map(([leadId, vList]) => {
      const lead = leadMap.get(leadId);
      const sorted = vList.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
      const campaign = lead?.campaign_id ? campaignMap.get(lead.campaign_id) : null;
      return {
        leadId,
        name: lead?.name ?? 'Unknown',
        phone: lead?.phone ?? '—',
        visits: vList.length,
        latest: sorted[0].scheduled_at,
        status: lead?.status ?? '—',
        campaign: campaign?.name ?? 'Organic/Walk-in',
      };
    });
    if (q) return rows.filter((r) => r.name.toLowerCase().includes(q) || r.phone.includes(q));
    return rows.sort((a, b) => b.visits - a.visits);
  }, [rangedVisits, leadMap, campaignMap, search]);

  // Analytics charts
  const monthlyData = useMemo(() => {
    const buckets = new Map<string, number>();
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      const count = visits.filter((v) => { const td = new Date(v.scheduled_at); return td >= d && td < e; }).length;
      buckets.set(label, count);
    }
    return [...buckets.entries()].map(([label, value]) => ({ label, value }));
  }, [visits]);

  const byCampaign = useMemo(() => {
    const m = new Map<string, number>();
    visits.forEach((v) => {
      const lead = leadMap.get(v.lead_id);
      const camp = lead?.campaign_id ? campaignMap.get(lead.campaign_id) : null;
      const k = camp?.name ?? 'Organic/Walk-in';
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [visits, leadMap, campaignMap]);

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    visits.forEach((v) => {
      const lead = leadMap.get(v.lead_id);
      const k = lead?.status ?? 'Unknown';
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [visits, leadMap]);

  // Calendar
  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calMonth]);

  const visitsByDay = useMemo(() => {
    const m = new Map<string, SiteVisit[]>();
    visits.forEach((v) => {
      const key = formatDate(v.scheduled_at);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(v);
    });
    return m;
  }, [visits]);

  function exportCsv() {
    const cols = ['Prospect', 'Phone', 'Visits', 'Latest Visit', 'Campaign', 'Status'];
    const lines = [cols.join(',')];
    prospects.forEach((r) => {
      lines.push([r.name, r.phone, r.visits, formatDateTime(r.latest), r.campaign, r.status].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'site-visits-export.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Site Visits</h1>
          <p className="text-[13px] text-gray-400">Track and analyse every site visit.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 card-shadow transition hover:text-gray-800">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi icon={CalendarClock} label="Today" value={kpis.today} tint="bg-blue-50 text-blue-700" />
        <Kpi icon={CalendarClock} label="This Week" value={kpis.week} tint="bg-violet-50 text-violet-700" />
        <Kpi icon={CalendarClock} label="This Month" value={kpis.month} tint="bg-emerald-50 text-emerald-700" />
        <Kpi icon={MapPin} label="Total Visits" value={kpis.total} tint="bg-teal-50 text-teal-700" />
        <Kpi icon={TrendingUp} label="Avg / Prospect" value={kpis.avg} tint="bg-amber-50 text-amber-700" />
      </div>

      {/* View toggle */}
      <div className="mb-4 flex justify-center">
        <div className="flex overflow-hidden rounded-full border border-black/5 bg-white card-shadow">
          {([['list', 'List', TableIcon], ['analytics', 'Analytics', BarChart3], ['calendar', 'Calendar', Calendar]] as const).map(([v, label, Icon]) => (
            <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition ${view === v ? 'brand-gradient text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* List view */}
      {view === 'list' && (
        <>
          {/* Date range selector */}
          <div className="mb-4 rounded-2xl border border-black/5 bg-white p-4 card-shadow">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-gray-400">Date Range:</span>
              {(['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom', 'all'] as const).map((p) => (
                <button key={p} onClick={() => setRangePreset(p)} className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${rangePreset === p ? 'brand-gradient text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {p === 'all' ? 'All Time' : p.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </button>
              ))}
              {rangePreset === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-300" />
                  <span className="text-gray-400">→</span>
                  <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-300" />
                </div>
              )}
            </div>

            {/* Range KPIs */}
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <RangeKpi icon={MapPin} label="Total Visits" value={rangeKpis.total} />
              <RangeKpi icon={Users} label="Unique Prospects" value={rangeKpis.uniqueProspects} />
              <RangeKpi icon={Repeat} label="Repeat Visits" value={rangeKpis.repeat} />
              <RangeKpi icon={TrendingUp} label="Avg / Prospect" value={rangeKpis.avg} />
            </div>
          </div>

          {/* Search */}
          <div className="mb-4 relative">
            <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full rounded-full border border-black/5 bg-white py-2.5 pl-11 pr-4 text-sm font-medium text-gray-900 outline-none card-shadow placeholder:text-gray-400 focus:border-emerald-200"
            />
          </div>

          {/* Prospects table */}
          <div className="overflow-hidden rounded-2xl border border-black/5 bg-white card-shadow">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="sticky top-0 bg-gray-50/90 backdrop-blur">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3">Prospect</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Visits</th>
                    <th className="px-4 py-3">Latest Visit</th>
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No site visits in this period.</td></tr>
                  ) : prospects.map((r) => (
                    <tr key={r.leadId} className="group border-t border-gray-100 transition hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <button onClick={() => onOpenLead(r.leadId)} className="font-semibold text-gray-900 hover:text-emerald-600">{r.name}</button>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">{r.phone}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[12px] font-bold text-violet-700">{r.visits}</span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-500">{formatDate(r.latest)}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-500">{r.campaign}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-500">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Analytics view */}
      {view === 'analytics' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
            <h3 className="mb-4 font-display text-base font-bold tracking-tight text-gray-900">Site Visits by Month</h3>
            <BarChart data={monthlyData} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
              <h3 className="mb-4 font-display text-sm font-bold text-gray-900">By Campaign</h3>
              <DonutChart data={byCampaign} />
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
              <h3 className="mb-4 font-display text-sm font-bold text-gray-900">By Lead Status</h3>
              <DonutChart data={byStatus} />
            </div>
          </div>
        </div>
      )}

      {/* Calendar view */}
      {view === 'calendar' && (
        <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-base font-bold tracking-tight text-gray-900">
              {calMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1">
              <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => { const d = new Date(); d.setDate(1); setCalMonth(d); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Today</button>
              <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((d, i) => {
              if (!d) return <div key={i} className="min-h-[72px] rounded-lg bg-gray-50/50" />;
              const dayVisits = visitsByDay.get(formatDate(d.toISOString())) ?? [];
              const isTodayCell = isToday(d.toISOString());
              return (
                <div key={i} className={`min-h-[72px] rounded-lg border p-1.5 transition hover:border-emerald-200 ${isTodayCell ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-100 bg-white'}`}>
                  <div className={`mb-1 text-[11px] font-bold ${isTodayCell ? 'text-emerald-600' : 'text-gray-500'}`}>{d.getDate()}</div>
                  <div className="space-y-0.5">
                    {dayVisits.slice(0, 3).map((v) => {
                      const lead = leadMap.get(v.lead_id);
                      return (
                        <button key={v.id} onClick={() => onOpenLead(v.lead_id)} className="block w-full truncate rounded bg-violet-50 px-1.5 py-0.5 text-left text-[10px] font-medium text-violet-700 transition hover:opacity-80">
                          {formatTime(v.scheduled_at)} {lead?.name ?? 'Visit'}
                        </button>
                      );
                    })}
                    {dayVisits.length > 3 && <div className="px-1.5 text-[10px] text-gray-400">+{dayVisits.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tint }: { icon: typeof CalendarClock; label: string; value: number | string; tint: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-3.5 card-shadow">
      <div className="flex items-center gap-2.5">
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${tint}`}><Icon className="h-4.5 w-4.5" /></div>
        <span className="font-display text-xl font-bold text-gray-900">{value}</span>
      </div>
      <div className="mt-2 text-[11px] font-medium text-gray-400">{label}</div>
    </div>
  );
}

function RangeKpi({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="font-display text-lg font-bold text-gray-900">{value}</span>
      </div>
      <div className="mt-1 text-[10px] font-medium text-gray-400">{label}</div>
    </div>
  );
}
