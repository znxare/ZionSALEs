import { useState, useMemo } from 'react';
import {
  Search, LayoutGrid, Table as TableIcon, ChevronDown, X, Filter,
  Phone, MessageCircle, CalendarClock, Pencil, Eye,
  Users, Flame, Sun, Snowflake, CheckCircle2,
  CheckSquare, Square, BarChart3, Download,
} from 'lucide-react';
import type { Lead, LeadStatus, LeadSource, Campaign, ColdReason } from '@/lib/supabase';
import {
  SOURCES, STATUSES, isToday, isOverdue, isFollowUpRequired,
  formatDate, formatTime, relativeDay, updateLead, deleteLead, scheduleFollowUp,
  toLocalInputValue, startOfDay, endOfDay, markLeadCold, fetchActivities,
} from '@/lib/crm';
import { statusStyles } from '@/lib/styles';
import { phoneCountryFlag } from '@/lib/normalize';
import EditLeadModal from './EditLeadModal';
import FollowUpSheet from './FollowUpSheet';
import ColdReasonModal from './ColdReasonModal';

type SortKey = 'newest' | 'oldest' | 'followup' | 'lastcontacted' | 'name' | 'hot';
type ViewMode = 'table' | 'card';
type CategoryTab =
  | 'all' | 'hot' | 'warm' | 'cold' | 'calling'
  | 'site_visits' | 'sold' | 'junk' | 'dead';
type DateRangePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';

interface Props {
  leads: Lead[];
  campaigns: Campaign[];
  onOpenLead: (id: string) => void;
  onChanged: () => void;
}

interface FilterState {
  sources: LeadSource[];
  statuses: LeadStatus[];
  siteVisitOnly: boolean;
  bookedOnly: boolean;
}

const CHART_COLORS = ['#1f6f43', '#c9a227', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

const STATUS_COLORS: Record<string, string> = {
  Hot: '#ef4444',
  Warm: '#f97316',
  Cold: '#0ea5e9',
  Calling: '#06b6d4',
  Dead: '#6b7280',
  Junk: '#9ca3af',
};

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'followup', label: 'Next Follow-up' },
  { value: 'lastcontacted', label: 'Last Contacted' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'hot', label: 'Hot Leads First' },
];

const tabConfig: { id: CategoryTab; label: string }[] = [
  { id: 'all', label: 'All Leads' },
  { id: 'hot', label: 'Hot Leads' },
  { id: 'warm', label: 'Warm Leads' },
  { id: 'cold', label: 'Cold Leads' },
  { id: 'calling', label: 'Calling' },
  { id: 'site_visits', label: 'Site Visits' },
  { id: 'sold', label: 'Sold' },
  { id: 'junk', label: 'Junk' },
  { id: 'dead', label: 'Dead Leads' },
];

function matchesTab(l: Lead, tab: CategoryTab): boolean {
  switch (tab) {
    case 'all': return true;
    case 'hot': return l.status === 'Hot';
    case 'warm': return l.status === 'Warm';
    case 'cold': return l.status === 'Cold';
    case 'calling': return l.status === 'Calling';
    case 'site_visits': return !!l.site_visit_at && !l.booked_at;
    case 'sold': return !!l.booked_at;
    case 'junk': return l.status === 'Junk';
    case 'dead': return l.status === 'Dead';
    default: return true;
  }
}

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
    case 'this_month': { const s = new Date(now.getFullYear(), now.getMonth(), 1); const e = new Date(now.getFullYear(), now.getMonth() + 1, 1); return { start: s, end: e }; }
    case 'last_month': { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 1); return { start: s, end: e }; }
    case 'custom': { const s = customStart ? new Date(customStart) : new Date(0); const e = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now); return { start: s, end: e }; }
    default: return { start: new Date(0), end: endOfDay(now) };
  }
}

export default function LeadManagement({ leads, campaigns, onOpenLead, onChanged }: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [view, setView] = useState<ViewMode>('table');
  const [showFilters, setShowFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [tab, setTab] = useState<CategoryTab>('all');
  const [filters, setFilters] = useState<FilterState>({
    sources: [], statuses: [], siteVisitOnly: false, bookedOnly: false,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Lead | null>(null);
  const [followUpFor, setFollowUpFor] = useState<Lead | null>(null);
  const [bulkStatus, setBulkStatus] = useState<LeadStatus | ''>('');
  const [coldFor, setColdFor] = useState<Lead | null>(null);
  const [page, setPage] = useState(0);
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const pageSize = 50;

  const campaignMap = useMemo(() => {
    const m = new Map<string, Campaign>();
    campaigns.forEach((c) => m.set(c.id, c));
    return m;
  }, [campaigns]);

  const range = useMemo(() => getRange(rangePreset, customStart, customEnd), [rangePreset, customStart, customEnd]);

  const tabCounts = useMemo(() => {
    const counts: Record<CategoryTab, number> = {
      all: 0, hot: 0, warm: 0, cold: 0, calling: 0,
      site_visits: 0, sold: 0, junk: 0, dead: 0,
    };
    leads.forEach((l) => {
      tabConfig.forEach((t) => {
        if (matchesTab(l, t.id)) counts[t.id]++;
      });
    });
    return counts;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = leads.filter((l) => {
      if (!matchesTab(l, tab)) return false;
      const created = new Date(l.created_at);
      if (created < range.start || created > range.end) return false;
      if (q) {
        const hay = `${l.name} ${l.phone} ${l.email ?? ''} ${l.city ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.sources.length && !filters.sources.includes(l.source as LeadSource)) return false;
      if (filters.statuses.length && !filters.statuses.includes(l.status)) return false;
      if (filters.siteVisitOnly && !l.site_visit_at) return false;
      if (filters.bookedOnly && !l.booked_at) return false;
      return true;
    });

    result.sort((a, b) => {
      switch (sort) {
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'followup': return new Date(a.next_followup_at).getTime() - new Date(b.next_followup_at).getTime();
        case 'lastcontacted': return (new Date(b.last_activity_at ?? 0).getTime()) - (new Date(a.last_activity_at ?? 0).getTime());
        case 'name': return a.name.localeCompare(b.name);
        case 'hot': {
          const rank = (s: string) => s === 'Hot' ? 0 : s === 'Warm' ? 1 : s === 'Cold' ? 2 : 3;
          return rank(a.status) - rank(b.status);
        }
        default: return 0;
      }
    });
    return result;
  }, [leads, search, filters, sort, tab, range]);

  const stats = useMemo(() => ({
    total: filtered.length,
    hot: filtered.filter((l) => l.status === 'Hot').length,
    warm: filtered.filter((l) => l.status === 'Warm').length,
    cold: filtered.filter((l) => l.status === 'Cold').length,
    booked: filtered.filter((l) => !!l.booked_at).length,
  }), [filtered]);

  // Date range analytics
  const rangeAnalytics = useMemo(() => {
    const totalLeads = filtered.length;
    const campaignCounts = new Map<string, number>();
    const statusCounts = new Map<string, number>();
    filtered.forEach((l) => {
      const camp = l.campaign_id ? campaignMap.get(l.campaign_id) : null;
      const ck = camp?.name ?? 'Organic/Walk-in';
      campaignCounts.set(ck, (campaignCounts.get(ck) ?? 0) + 1);
      statusCounts.set(l.status, (statusCounts.get(l.status) ?? 0) + 1);
    });
    const campaignData = [...campaignCounts.entries()].map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] })).sort((a, b) => b.value - a.value);
    const statusData = [...statusCounts.entries()].map(([label, value]) => {
      const color = STATUS_COLORS[label] ?? '#9ca3af';
      const pct = totalLeads > 0 ? Math.round((value / totalLeads) * 100) : 0;
      return { label, value, color, pct };
    }).sort((a, b) => b.value - a.value);
    return { totalLeads, campaignData, statusData };
  }, [filtered, campaignMap]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  function toggleFilter<T>(key: keyof FilterState, value: T, arr: T[]) {
    const current = arr as T[];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setFilters({ ...filters, [key]: next });
    setPage(0);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map((l) => l.id)));
  }

  function clearFilters() {
    setFilters({ sources: [], statuses: [], siteVisitOnly: false, bookedOnly: false });
    setSearch('');
    setPage(0);
  }

  const activeFilterCount =
    filters.sources.length + filters.statuses.length +
    (filters.siteVisitOnly ? 1 : 0) + (filters.bookedOnly ? 1 : 0);

  async function applyBulkStatus() {
    if (!bulkStatus || selected.size === 0) return;
    await Promise.all([...selected].map((id) => updateLead(id, { status: bulkStatus as LeadStatus })));
    setBulkStatus('');
    setSelected(new Set());
    onChanged();
  }

  async function applyBulkFollowUp(when: string, summary: string) {
    if (selected.size === 0) return;
    await Promise.all([...selected].map((id) => scheduleFollowUp({ id, next_followup_at: when } as Lead, when, summary)));
    setFollowUpFor(null);
    setSelected(new Set());
    onChanged();
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} leads? This cannot be undone.`)) return;
    await Promise.all([...selected].map((id) => deleteLead(id)));
    setSelected(new Set());
    onChanged();
  }

  function exportCsv() {
    const rows = filtered.filter((l) => selected.has(l.id));
    const cols = ['Name', 'Phone', 'Email', 'City', 'Source', 'Status', 'Next Follow-up', 'Created'];
    const lines = [cols.join(',')];
    rows.forEach((l) => {
      lines.push([l.name, l.phone, l.email ?? '', l.city ?? '', l.source, l.status, l.next_followup_at, l.created_at].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leads-export.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const [exporting, setExporting] = useState(false);

  async function exportFullCsv() {
    setExporting(true);
    try {
      const rows = selected.size > 0 ? filtered.filter((l) => selected.has(l.id)) : filtered;
      const campaignName = (id: string | null) => id ? (campaignMap.get(id)?.name ?? '') : '';
      const cols = ['Name', 'Phone', 'Email', 'City', 'Source', 'Status', 'Campaign', 'Budget', 'Next Follow-up', 'Last Contacted', 'Last Activity', 'Site Visit', 'Booked', 'Notes', 'Created'];
      const lines = [cols.join(',')];
      for (const l of rows) {
        let notes = l.notes ?? '';
        try {
          const acts = await fetchActivities(l.id);
          const noteLines = acts.map((a) => `[${formatDate(a.created_at)} ${formatTime(a.created_at)}] ${a.type}: ${a.summary}`);
          if (noteLines.length > 0) {
            notes = notes ? notes + '\n' + noteLines.join('\n') : noteLines.join('\n');
          }
        } catch { /* ignore activity fetch errors */ }
        lines.push([
          l.name, l.phone, l.email ?? '', l.city ?? '', l.source, l.status,
          campaignName(l.campaign_id), l.budget ?? '',
          l.next_followup_at ? formatDate(l.next_followup_at) : '',
          l.last_contacted_at ? formatDate(l.last_contacted_at) : '',
          l.last_activity_type ?? '',
          l.site_visit_at ? formatDate(l.site_visit_at) : '',
          l.booked_at ? formatDate(l.booked_at) : '',
          notes, formatDate(l.created_at),
        ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `leads-full-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function inlineStatus(lead: Lead, status: LeadStatus) {
    if (status === 'Cold') {
      setColdFor(lead);
      return;
    }
    const patch: Partial<Lead> = { status };
    if (status === 'Dead' || status === 'Junk') patch.next_followup_at = null;
    await updateLead(lead.id, patch);
    onChanged();
  }

  async function confirmCold(reason: ColdReason, nextReactivationAt: string) {
    if (!coldFor) return;
    await markLeadCold(coldFor, reason, nextReactivationAt);
    setColdFor(null);
    onChanged();
  }

  async function inlineFollowUp(lead: Lead, value: string) {
    if (!value) return;
    await updateLead(lead.id, { next_followup_at: new Date(value).toISOString() });
    onChanged();
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* Summary + date range card */}
      <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <StatPill icon={Users} label="Total" value={stats.total} tint="text-gray-700 bg-gray-100" />
          <StatPill icon={Flame} label="Hot" value={stats.hot} tint="text-red-700 bg-red-50" />
          <StatPill icon={Sun} label="Warm" value={stats.warm} tint="text-amber-700 bg-amber-50" />
          <StatPill icon={Snowflake} label="Cold" value={stats.cold} tint="text-sky-700 bg-sky-50" />
          <StatPill icon={CheckCircle2} label="Booked" value={stats.booked} tint="text-emerald-700 bg-emerald-50" />
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-gray-100" />

        {/* Date range + analytics toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-gray-400">Date Created:</span>
          {(['all', 'today', 'yesterday', 'this_week', 'this_month', 'last_month', 'custom'] as const).map((p) => (
            <button key={p} onClick={() => { setRangePreset(p); setPage(0); }} className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${rangePreset === p ? 'green-gradient text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p === 'all' ? 'All Time' : p.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
          {rangePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => { setCustomStart(e.target.value); setPage(0); }} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-300" />
              <span className="text-gray-400">→</span>
              <input type="date" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); setPage(0); }} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-300" />
            </div>
          )}
          <button
            onClick={() => setShowAnalytics((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${showAnalytics ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            <BarChart3 className="h-3.5 w-3.5" /> {showAnalytics ? 'Hide' : 'Show'} Analytics
          </button>
          <button
            onClick={exportFullCsv}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[12px] font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> {exporting ? 'Exporting…' : 'Export with Notes'}
          </button>
        </div>

        {/* Analytics panel */}
        {showAnalytics && (
          <div className="mt-4 space-y-4 animate-fade-up border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <AnalyticsCard label="Total Leads" value={String(rangeAnalytics.totalLeads)} />
              <AnalyticsCard label="Campaigns" value={String(rangeAnalytics.campaignData.length)} />
              <AnalyticsCard label="Statuses" value={String(rangeAnalytics.statusData.length)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
                <h4 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-gray-500">Campaign-wise Lead Count</h4>
                {rangeAnalytics.campaignData.length > 0 ? (
                  <div className="space-y-2">
                    {rangeAnalytics.campaignData.map((c) => (
                      <div key={c.label} className="flex items-center justify-between text-[12px]">
                        <span className="truncate text-gray-600">{c.label}</span>
                        <span className="ml-2 shrink-0 font-bold text-gray-900">{c.value}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[12px] text-gray-400">No data.</p>}
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
                <h4 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-gray-500">Status Distribution</h4>
                {rangeAnalytics.statusData.length > 0 ? (
                  <InteractiveStatusChart data={rangeAnalytics.statusData} total={rangeAnalytics.totalLeads} onStatusClick={(s) => { setFilters({ ...filters, statuses: s ? [s as LeadStatus] : [] }); setPage(0); }} />
                ) : <p className="text-[12px] text-gray-400">No data.</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {tabConfig.map((t) => {
          const active = tab === t.id;
          const count = tabCounts[t.id] ?? 0;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setPage(0); }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition ${active ? 'green-gradient text-white shadow-sm' : 'bg-white text-gray-500 ring-1 ring-black/5 hover:text-gray-700'}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + sort + view */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, phone, email, city…"
            className="w-full rounded-full border border-black/5 bg-white py-2.5 pl-11 pr-4 text-sm font-medium text-gray-900 outline-none card-shadow placeholder:text-gray-400 focus:border-emerald-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`relative flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-sm font-medium transition ${activeFilterCount > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-black/5 bg-white text-gray-600 card-shadow'}`}
          >
            <Filter className="h-4 w-4" /> Filters
            {activeFilterCount > 0 && <span className="grid h-5 w-5 place-items-center rounded-full green-gradient text-[11px] text-white">{activeFilterCount}</span>}
          </button>
          <div className="relative">
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="appearance-none rounded-full border border-black/5 bg-white py-2.5 pl-3.5 pr-9 text-sm font-medium text-gray-600 outline-none card-shadow focus:border-emerald-200">
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="flex overflow-hidden rounded-full border border-black/5 bg-white card-shadow">
            <button onClick={() => setView('table')} className={`px-2.5 py-2.5 transition ${view === 'table' ? 'green-gradient text-white' : 'text-gray-400 hover:text-gray-600'}`}><TableIcon className="h-4 w-4" /></button>
            <button onClick={() => setView('card')} className={`px-2.5 py-2.5 transition ${view === 'card' ? 'green-gradient text-white' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 animate-fade-up rounded-2xl border border-black/5 bg-white p-4 card-shadow">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Filters</h3>
            {activeFilterCount > 0 && <button onClick={clearFilters} className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-700">Clear all</button>}
          </div>
          <div className="space-y-3">
            <FilterGroup label="Lead Source">
              {SOURCES.map((s) => <Chip key={s} active={filters.sources.includes(s)} onClick={() => toggleFilter('sources', s, filters.sources)} label={s} />)}
            </FilterGroup>
            <FilterGroup label="Status">
              {STATUSES.map((s) => <Chip key={s} active={filters.statuses.includes(s)} onClick={() => toggleFilter('statuses', s, filters.statuses)} label={s} />)}
            </FilterGroup>
            <FilterGroup label="Quick Filters">
              <Chip active={filters.siteVisitOnly} onClick={() => setFilters({ ...filters, siteVisitOnly: !filters.siteVisitOnly })} label="Site Visit Scheduled" />
              <Chip active={filters.bookedOnly} onClick={() => setFilters({ ...filters, bookedOnly: !filters.bookedOnly })} label="Booked" />
            </FilterGroup>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 animate-fade-up rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <span className="text-sm font-bold text-emerald-800">{selected.size} selected</span>
          <div className="mx-1 h-5 w-px bg-emerald-200" />
          <div className="relative">
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as LeadStatus)} className="appearance-none rounded-lg border border-emerald-200 bg-white py-1.5 pl-3 pr-8 text-[13px] font-medium text-gray-700 outline-none">
              <option value="">Change status…</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {bulkStatus && <button onClick={applyBulkStatus} className="rounded-lg green-gradient px-3 py-1.5 text-[13px] font-semibold text-white">Apply</button>}
          <button onClick={() => setFollowUpFor({ id: [...selected][0], next_followup_at: new Date().toISOString() } as Lead)} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-emerald-700">Schedule Follow-up</button>
          <button onClick={exportCsv} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-700">Quick Export</button>
          <button onClick={exportFullCsv} disabled={exporting} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-emerald-700 disabled:opacity-50">{exporting ? 'Exporting…' : 'Export with Notes'}</button>
          <button onClick={bulkDelete} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-red-600">Delete</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto rounded-lg p-1.5 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Table view */}
      {view === 'table' && (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white card-shadow">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <th className="w-10 px-4 py-3">
                    <button onClick={toggleAll}>{selected.size === paged.length && paged.length > 0 ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button>
                  </th>
                  <th className="px-4 py-3">Lead Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Next Follow-up</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((l) => {
                  const ss = statusStyles(l.status);
                  const overdue = isOverdue(l.next_followup_at) && !isToday(l.next_followup_at);
                  return (
                    <tr key={l.id} className="group border-t border-gray-100 transition hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelected(l.id)}>
                          {selected.has(l.id) ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4 text-gray-300" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => onOpenLead(l.id)} className="font-semibold text-gray-900 hover:text-emerald-600">{l.name}</button>
                        {l.city && <div className="text-[11px] text-gray-400">{l.city}</div>}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">
                        <span className="flex items-center gap-1.5">
                          {phoneCountryFlag(l.phone) && <span title={phoneCountryFlag(l.phone)?.name}>{phoneCountryFlag(l.phone)?.flag}</span>}
                          {l.phone}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-500">{l.source}</td>
                      <td className="px-4 py-3">
                        <InlineStatusDropdown lead={l} onChange={(s) => inlineStatus(l, s)} />
                      </td>
                      <td className="px-4 py-3">
                        {isFollowUpRequired(l) ? (
                          <input
                            type="datetime-local"
                            defaultValue={toLocalInputValue(l.next_followup_at)}
                            onChange={(e) => inlineFollowUp(l, e.target.value)}
                            className={`w-[150px] rounded-lg border-0 bg-transparent px-1 py-1 text-[12px] font-medium outline-none hover:bg-gray-50 focus:bg-gray-50 focus:ring-1 focus:ring-emerald-200 ${overdue ? 'text-red-600' : 'text-gray-700'}`}
                          />
                        ) : (
                          <span className="text-[12px] text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {l.last_activity_type ? (
                          <>
                            <div className="text-[13px] text-gray-600">{l.last_activity_type}</div>
                            <div className="text-[11px] text-gray-400">{l.last_activity_at ? formatDate(l.last_activity_at) : '—'}</div>
                          </>
                        ) : <span className="text-[13px] text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-400">{formatDate(l.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <RowAction icon={Phone} color="text-emerald-600" onClick={() => window.open(`tel:${l.phone}`)} title="Call" />
                          <RowAction icon={MessageCircle} color="text-green-600" onClick={() => window.open(`https://wa.me/${l.phone.replace(/\D/g, '')}`)} title="WhatsApp" />
                          <RowAction icon={CalendarClock} color="text-amber-600" onClick={() => setFollowUpFor(l)} title="Schedule Follow-up" />
                          <RowAction icon={Pencil} color="text-gray-500" onClick={() => setEditing(l)} title="Edit" />
                          <RowAction icon={Eye} color="text-gray-500" onClick={() => onOpenLead(l.id)} title="View" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {paged.length === 0 && <div className="px-4 py-12 text-center text-sm text-gray-400">No leads match your filters.</div>}
        </div>
      )}

      {/* Card view */}
      {view === 'card' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {paged.map((l) => {
            const ss = statusStyles(l.status);
            const overdue = isOverdue(l.next_followup_at) && !isToday(l.next_followup_at);
            return (
              <div key={l.id} className="group rounded-2xl border border-black/5 bg-white p-4 card-shadow transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => onOpenLead(l.id)} className="flex items-center gap-2.5 text-left">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">{l.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="font-semibold text-gray-900">{l.name}</div>
                      <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
                        {phoneCountryFlag(l.phone) && <span title={phoneCountryFlag(l.phone)?.name}>{phoneCountryFlag(l.phone)?.flag}</span>}
                        {l.phone}
                      </div>
                    </div>
                  </button>
                  <button onClick={() => toggleSelected(l.id)}>
                    {selected.has(l.id) ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4 text-gray-300" />}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <InlineStatusDropdown lead={l} onChange={(s) => inlineStatus(l, s)} />
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{l.source}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[12px]">
                  <span className="text-gray-400">Next follow-up</span>
                  {isFollowUpRequired(l) ? (
                    <span className={`font-semibold ${overdue ? 'text-red-600' : 'text-gray-700'}`}>{overdue ? relativeDay(l.next_followup_at) : formatDate(l.next_followup_at)}</span>
                  ) : (
                    <span className="text-gray-300">Not required</span>
                  )}
                </div>
                {l.last_activity_type && (
                  <div className="mt-1 flex items-center justify-between text-[12px]">
                    <span className="text-gray-400">Last activity</span>
                    <span className="font-medium text-gray-600">{l.last_activity_type}</span>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-1 border-t border-gray-100 pt-3">
                  <CardAction icon={Phone} color="text-emerald-600 bg-emerald-50" onClick={() => window.open(`tel:${l.phone}`)} title="Call" />
                  <CardAction icon={MessageCircle} color="text-green-600 bg-green-50" onClick={() => window.open(`https://wa.me/${l.phone.replace(/\D/g, '')}`)} title="WhatsApp" />
                  <CardAction icon={CalendarClock} color="text-amber-600 bg-amber-50" onClick={() => setFollowUpFor(l)} title="Follow-up" />
                  <CardAction icon={Pencil} color="text-gray-600 bg-gray-100" onClick={() => setEditing(l)} title="Edit" />
                  <CardAction icon={Eye} color="text-gray-600 bg-gray-100" onClick={() => onOpenLead(l.id)} title="View" />
                </div>
              </div>
            );
          })}
          {paged.length === 0 && <div className="col-span-full py-12 text-center text-sm text-gray-400">No leads match your filters.</div>}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="text-gray-400">Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-600 disabled:opacity-40">Prev</button>
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-600 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Modals */}
      {editing && (
        <EditLeadModal lead={editing} campaigns={campaigns} onClose={() => setEditing(null)} onSaved={(updated) => { setEditing(null); if (updated.status === 'Cold' && editing.status !== 'Cold' && !updated.cold_reason) { setColdFor(updated); } else { onChanged(); } void updated; }} />
      )}
      {coldFor && (
        <ColdReasonModal lead={coldFor} onClose={() => setColdFor(null)} onConfirm={confirmCold} />
      )}
      {followUpFor && (
        <FollowUpSheet
          current={followUpFor.next_followup_at}
          onClose={() => setFollowUpFor(null)}
          onPick={async (when, summary) => {
            if (selected.size > 0) { await applyBulkFollowUp(when, summary); }
            else { await scheduleFollowUp(followUpFor, when, summary); onChanged(); setFollowUpFor(null); }
          }}
        />
      )}
    </div>
  );
}

function InlineStatusDropdown({ lead, onChange }: { lead: Lead; onChange: (s: LeadStatus) => void }) {
  const ss = statusStyles(lead.status);
  return (
    <div className="relative inline-flex">
      <select
        value={lead.status}
        onChange={(e) => onChange(e.target.value as LeadStatus)}
        className={`appearance-none rounded-full ${ss.bg} ${ss.text} px-2.5 py-1 pr-7 text-[11px] font-semibold ring-1 ${ss.ring} outline-none cursor-pointer hover:opacity-90`}
      >
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-60" />
    </div>
  );
}

function AnalyticsCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="font-display text-xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-[11px] font-medium text-gray-400">{label}</div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, tint }: { icon: typeof Users; label: string; value: number; tint: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-3 card-shadow">
      <div className="flex items-center gap-2">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${tint}`}><Icon className="h-4 w-4" /></div>
        <span className="font-display text-xl font-bold text-gray-900">{value}</span>
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-gray-400">{label}</div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${active ? 'green-gradient text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
  );
}

function RowAction({ icon: Icon, color, onClick, title }: { icon: typeof Phone; color: string; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className={`rounded-lg p-1.5 transition hover:bg-gray-100 ${color}`}><Icon className="h-4 w-4" /></button>
  );
}

function CardAction({ icon: Icon, color, onClick, title }: { icon: typeof Phone; color: string; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold transition hover:opacity-80 ${color}`}><Icon className="h-4 w-4" /></button>
  );
}

function InteractiveStatusChart({ data, total, onStatusClick }: {
  data: { label: string; value: number; color: string; pct: number }[];
  total: number;
  onStatusClick: (status: string | null) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const size = 180;
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const active = hovered ?? null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {total === 0 ? (
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="14" />
          ) : (
            data.map((d, i) => {
              const len = (d.value / total) * circumference;
              const seg = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={active === d.label ? 18 : 14}
                  strokeDasharray={`${len} ${circumference - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  className="cursor-pointer transition-all duration-200"
                  style={{ opacity: active && active !== d.label ? 0.35 : 1 }}
                  onMouseEnter={() => setHovered(d.label)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onStatusClick(active === d.label ? null : d.label)}
                />
              );
              offset += len;
              return seg;
            })
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {active ? (
            <>
              <span className="font-display text-2xl font-bold" style={{ color: data.find((d) => d.label === active)?.color }}>{data.find((d) => d.label === active)?.value}</span>
              <span className="text-[11px] font-medium text-gray-500">{data.find((d) => d.label === active)?.pct}%</span>
              <span className="text-[10px] text-gray-400">{active}</span>
            </>
          ) : (
            <>
              <span className="font-display text-2xl font-bold text-gray-900">{total}</span>
              <span className="text-[10px] font-medium text-gray-400">Total Leads</span>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:space-y-0">
        {data.map((d, i) => (
          <button
            key={i}
            onMouseEnter={() => setHovered(d.label)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onStatusClick(active === d.label ? null : d.label)}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition ${active === d.label ? 'bg-gray-100 ring-1 ring-gray-200' : 'hover:bg-gray-50'}`}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="font-medium text-gray-600">{d.label}</span>
            <span className="ml-auto font-bold text-gray-900">{d.value}</span>
            <span className="text-gray-400">{d.pct}%</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 sm:ml-auto sm:max-w-[140px]">Click a status to filter the lead list</p>
    </div>
  );
}
