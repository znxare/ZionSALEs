import { useState, useEffect, useMemo } from 'react';
import {
  Plus, X, Save, Megaphone, TrendingUp, TrendingDown, Users, Flame, MapPin,
  CheckCircle2, Trash2, Pencil, ChevronDown, BarChart3, Target, Award, AlertCircle,
  Archive, ArchiveRestore, Calendar, Phone, Info,
} from 'lucide-react';
import type { Lead, Campaign, CampaignInsert, CampaignType, CampaignPlatform } from '@/lib/supabase';
import {
  fetchCampaigns, createCampaign, updateCampaign, deleteCampaign,
  archiveCampaign, unarchiveCampaign,
  CAMPAIGN_TYPES, CAMPAIGN_PLATFORMS, formatDate,
  leadQualityScore,
} from '@/lib/crm';
import { BarChart, LineChart, DonutChart } from './charts';

interface Props {
  leads: Lead[];
  onLeadsChanged: () => void;
}

type TimelinePeriod = 'daily' | 'weekly' | 'monthly';

export default function CampaignAnalytics({ leads, onLeadsChanged }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const data = await fetchCampaigns(showArchived);
      setCampaigns(data);
    } finally {
      setLoading(false);
    }
  }

  async function withErrorHandling(action: () => Promise<void>, message: string) {
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : message);
    }
  }

  useEffect(() => { load(); }, [showArchived]);

  // Date range filter
  const dateFilteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const created = new Date(l.created_at);
      if (dateFrom && created < new Date(`${dateFrom}T00:00`)) return false;
      if (dateTo && created > new Date(`${dateTo}T23:59`)) return false;
      return true;
    });
  }, [leads, dateFrom, dateTo]);

  // Leads grouped by campaign
  const leadsByCampaign = useMemo(() => {
    const m = new Map<string, Lead[]>();
    dateFilteredLeads.forEach((l) => {
      const key = l.campaign_id ?? 'organic';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    });
    return m;
  }, [dateFilteredLeads]);

  // Organic / unassigned leads (campaign_id is null)
  const organicLeads = useMemo(() => leadsByCampaign.get('organic') ?? [], [leadsByCampaign]);

  // Campaign metrics
  const campaignMetrics = useMemo(() => {
    const fromCampaigns = campaigns.map((c) => {
      const cLeads = leadsByCampaign.get(c.id) ?? [];
      const total = cLeads.length;
      const contacted = cLeads.filter((l) => l.last_contacted_at || l.last_activity_type).length;
      const hot = cLeads.filter((l) => l.status === 'Hot').length;
      const warm = cLeads.filter((l) => l.status === 'Warm').length;
      const cold = cLeads.filter((l) => l.status === 'Cold').length;
      const siteVisitScheduled = cLeads.filter((l) => !!l.site_visit_at).length;
      const siteVisitDone = cLeads.filter((l) => !!l.site_visit_at).length;
      const bookings = cLeads.filter((l) => !!l.booked_at).length;
      const calling = cLeads.filter((l) => l.status === 'Calling').length;
      const dead = cLeads.filter((l) => l.status === 'Dead').length;
      const junk = cLeads.filter((l) => l.status === 'Junk').length;
      const duplicate = 0;
      const interested = hot + warm;
      const conversionRate = total > 0 ? Math.round((bookings / total) * 100) : 0;
      const tourToBooking = siteVisitDone > 0 ? Math.round((bookings / siteVisitDone) * 100) : 0;
      const costPerLead = c.budget && total > 0 ? Math.round(c.budget / total) : null;
      const { score, rating } = leadQualityScore(cLeads);
      return {
        campaign: c, total, contacted, hot, warm, cold, calling, dead, junk, duplicate, siteVisitScheduled, siteVisitDone,
        bookings, interested, conversionRate, tourToBooking, costPerLead,
        qualityScore: score, qualityRating: rating,
      };
    });

    // Add organic / unassigned as a pseudo-campaign row so totals match
    if (organicLeads.length > 0) {
      const total = organicLeads.length;
      const hot = organicLeads.filter((l) => l.status === 'Hot').length;
      const warm = organicLeads.filter((l) => l.status === 'Warm').length;
      const cold = organicLeads.filter((l) => l.status === 'Cold').length;
      const siteVisitDone = organicLeads.filter((l) => !!l.site_visit_at).length;
      const bookings = organicLeads.filter((l) => !!l.booked_at).length;
      const calling = organicLeads.filter((l) => l.status === 'Calling').length;
      const dead = organicLeads.filter((l) => l.status === 'Dead').length;
      const junk = organicLeads.filter((l) => l.status === 'Junk').length;
      const contacted = organicLeads.filter((l) => l.last_contacted_at || l.last_activity_type).length;
      const { score, rating } = leadQualityScore(organicLeads);
      fromCampaigns.push({
        campaign: {
          id: 'organic',
          name: 'Organic / Unassigned',
          type: 'Organic' as CampaignType,
          platform: null,
          start_date: null,
          end_date: null,
          budget: null,
          description: null,
          archived: false,
          created_at: '',
        },
        total, contacted, hot, warm, cold, calling, dead, junk, duplicate: 0,
        siteVisitScheduled: siteVisitDone, siteVisitDone, bookings,
        interested: hot + warm,
        conversionRate: total > 0 ? Math.round((bookings / total) * 100) : 0,
        tourToBooking: siteVisitDone > 0 ? Math.round((bookings / siteVisitDone) * 100) : 0,
        costPerLead: null,
        qualityScore: score, qualityRating: rating,
      });
    }

    return fromCampaigns;
  }, [campaigns, leadsByCampaign, organicLeads]);

  // Auto insights
  const insights = useMemo(() => {
    if (campaignMetrics.length === 0) return [];
    const result: { type: 'best' | 'conversion' | 'visits' | 'lowest' | 'attention'; text: string; icon: typeof Award }[] = [];

    const best = [...campaignMetrics].sort((a, b) => b.qualityScore - a.qualityScore)[0];
    if (best && best.total > 0) result.push({ type: 'best', text: `Best performing: ${best.campaign.name} (${best.qualityScore}% quality score)`, icon: Award });

    const highestConv = [...campaignMetrics].sort((a, b) => b.conversionRate - a.conversionRate)[0];
    if (highestConv && highestConv.bookings > 0) result.push({ type: 'conversion', text: `Highest conversion: ${highestConv.campaign.name} (${highestConv.conversionRate}% booking rate)`, icon: TrendingUp });

    const mostVisits = [...campaignMetrics].sort((a, b) => b.siteVisitDone - a.siteVisitDone)[0];
    if (mostVisits && mostVisits.siteVisitDone > 0) result.push({ type: 'visits', text: `Most site visits: ${mostVisits.campaign.name} (${mostVisits.siteVisitDone} visits)`, icon: MapPin });

    const lowest = [...campaignMetrics].filter((m) => m.total >= 3).sort((a, b) => a.qualityScore - b.qualityScore)[0];
    if (lowest && lowest.qualityScore < 20) result.push({ type: 'lowest', text: `Lowest quality: ${lowest.campaign.name} (${lowest.qualityScore}% — consider reducing budget)`, icon: TrendingDown });

    const attention = [...campaignMetrics].filter((m) => m.total >= 5 && m.contacted / m.total < 0.5)[0];
    if (attention) result.push({ type: 'attention', text: `Needs attention: ${attention.campaign.name} (${Math.round((attention.contacted / attention.total) * 100)}% contacted)`, icon: AlertCircle });

    return result;
  }, [campaignMetrics]);

  // Comparison chart data
  const comparisonData = useMemo(() => {
    return campaignMetrics.filter((m) => m.total > 0).map((m) => ({
      label: m.campaign.name.length > 12 ? m.campaign.name.slice(0, 10) + '…' : m.campaign.name,
      value: m.total,
    }));
  }, [campaignMetrics]);

  // Overall lead trend across ALL campaigns (for main view)
  const [overallPeriod, setOverallPeriod] = useState<TimelinePeriod>('weekly');
  const overallTrendData = useMemo(() => {
    const buckets = new Map<string, number>();
    const now = new Date();

    if (overallPeriod === 'daily') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const count = dateFilteredLeads.filter((l) => new Date(l.created_at).toDateString() === d.toDateString()).length;
        buckets.set(label, count);
      }
    } else if (overallPeriod === 'weekly') {
      for (let i = 7; i >= 0; i--) {
        const ref = new Date(now); ref.setDate(ref.getDate() - i * 7);
        const sow = new Date(ref); sow.setDate(sow.getDate() - ((sow.getDay() + 6) % 7));
        const eow = new Date(sow); eow.setDate(eow.getDate() + 7);
        const label = i === 0 ? 'This Wk' : `-${i}W`;
        const count = dateFilteredLeads.filter((l) => { const td = new Date(l.created_at); return td >= sow && td < eow; }).length;
        buckets.set(label, count);
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const label = d.toLocaleDateString('en-IN', { month: 'short' });
        const count = dateFilteredLeads.filter((l) => { const td = new Date(l.created_at); return td >= d && td < e; }).length;
        buckets.set(label, count);
      }
    }
    return [...buckets.entries()].map(([label, value]) => ({ label, value }));
  }, [dateFilteredLeads, overallPeriod]);

  // Funnel for selected campaign
  const funnel = useMemo(() => {
    if (!selectedCampaign) return null;
    const cLeads = leadsByCampaign.get(selectedCampaign.id) ?? [];
    const total = cLeads.length;
    const contacted = cLeads.filter((l) => l.last_contacted_at || l.last_activity_type).length;
    const interested = cLeads.filter((l) => l.status === 'Hot' || l.status === 'Warm').length;
    const siteVisits = cLeads.filter((l) => !!l.site_visit_at).length;
    const stages = [
      { label: 'Leads Generated', value: total },
      { label: 'Contacted', value: contacted },
      { label: 'Interested', value: interested },
      { label: 'Site Visits', value: siteVisits },
    ];
    return stages.map((s, i) => {
      const prev = i === 0 ? s.value : stages[i - 1].value;
      const conv = prev > 0 ? Math.round((s.value / prev) * 100) : 0;
      const dropOff = i > 0 ? 100 - conv : 0;
      return { ...s, conv, dropOff };
    });
  }, [selectedCampaign, leadsByCampaign]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {actionError && (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /> {actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-3 shrink-0 rounded-full p-1 text-red-400 hover:bg-red-100"><X className="h-4 w-4" /></button>
        </div>
      )}
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Campaign Analytics</h1>
          <p className="text-[13px] text-gray-400">Measure which campaigns generate the best quality leads.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${showArchived ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-black/5 bg-white text-gray-600 card-shadow'}`}
          >
            {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {showArchived ? 'Show Active' : 'Archived'}
          </button>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-full brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95">
            <Plus className="h-4 w-4" /> New Campaign
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-black/5 bg-white p-4 card-shadow">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <Calendar className="h-4 w-4 text-gray-400" /> Date Range
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-medium text-gray-400">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-emerald-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-medium text-gray-400">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-emerald-300"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-[12px] font-semibold text-gray-500 transition hover:bg-gray-200"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-[12px] text-gray-400">{dateFilteredLeads.length} leads in range</span>
      </div>

      {/* Auto Insights */}
      {insights.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((ins, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 card-shadow">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                ins.type === 'best' ? 'bg-emerald-50 text-emerald-600' :
                ins.type === 'conversion' ? 'bg-amber-50 text-amber-600' :
                ins.type === 'visits' ? 'bg-violet-50 text-violet-600' :
                ins.type === 'lowest' ? 'bg-red-50 text-red-500' :
                'bg-orange-50 text-orange-600'
              }`}>
                <ins.icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-[13px] font-medium text-gray-700">{ins.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lead Trend - Monthly/Weekly */}
      {dateFilteredLeads.length > 0 && (
        <div className="mb-6 rounded-2xl border border-black/5 bg-white p-5 card-shadow">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-base font-bold tracking-tight text-gray-900">Lead Inflow Trend</h3>
            <div className="flex overflow-hidden rounded-full border border-gray-200">
              {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                <button key={p} onClick={() => setOverallPeriod(p)} className={`px-3 py-1 text-[12px] font-medium capitalize transition ${overallPeriod === p ? 'brand-gradient text-white' : 'text-gray-500 hover:text-gray-700'}`}>{p}</button>
              ))}
            </div>
          </div>
          <LineChart data={overallTrendData} height={200} />
          <p className="mt-2 text-[11px] text-gray-400">Counts leads by their creation date within each period. Daily shows the last 7 days, weekly shows the last 8 weeks (Monday–Sunday), and monthly shows the last 6 calendar months. Only leads matching the date range filter above are included.</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-gray-50 p-3 text-center">
              <div className="font-display text-lg font-bold text-gray-900">{overallTrendData.reduce((s, d) => s + d.value, 0)}</div>
              <div className="text-[10px] font-medium text-gray-400">Total in Range</div>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center">
              <div className="font-display text-lg font-bold text-gray-900">{overallTrendData.length > 0 ? Math.max(...overallTrendData.map((d) => d.value)) : 0}</div>
              <div className="text-[10px] font-medium text-gray-400">Peak {overallPeriod === 'monthly' ? 'Month' : overallPeriod === 'weekly' ? 'Week' : 'Day'}</div>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center">
              <div className="font-display text-lg font-bold text-gray-900">{overallTrendData.length > 0 ? Math.round(overallTrendData.reduce((s, d) => s + d.value, 0) / overallTrendData.length) : 0}</div>
              <div className="text-[10px] font-medium text-gray-400">Avg per {overallPeriod === 'monthly' ? 'Month' : overallPeriod === 'weekly' ? 'Week' : 'Day'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign cards grid */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {campaignMetrics.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-500">No campaigns yet.</p>
            <p className="mt-1 text-[12px] text-gray-400">Create a campaign to start tracking lead quality by source.</p>
          </div>
        )}
        {campaignMetrics.filter((m) => m.campaign.id !== 'organic').map((m) => (
          <div key={m.campaign.id} className="rounded-2xl border border-black/5 bg-white p-5 card-shadow transition hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold tracking-tight text-gray-900">{m.campaign.name}</h3>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-gray-400">
                  <span className={`rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500 ${m.campaign.archived ? 'opacity-60' : ''}`}>{m.campaign.type}</span>
              {m.campaign.archived && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">ARCHIVED</span>}
                  {m.campaign.platform && <span>· {m.campaign.platform}</span>}
                  {m.campaign.start_date && <span>· {formatDate(m.campaign.start_date)}</span>}
                </div>
                {m.campaign.description && (
                  <p className="mt-1.5 text-[12px] text-gray-500">{m.campaign.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditing(m.campaign)} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"><Pencil className="h-4 w-4" /></button>
                {m.campaign.archived ? (
                  <button onClick={() => withErrorHandling(async () => { await unarchiveCampaign(m.campaign.id); await load(); onLeadsChanged(); }, 'Could not restore this campaign. Please try again.')} title="Restore" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-600"><ArchiveRestore className="h-4 w-4" /></button>
                ) : (
                  <button onClick={() => withErrorHandling(async () => { await archiveCampaign(m.campaign.id); await load(); onLeadsChanged(); }, 'Could not archive this campaign. Please try again.')} title="Archive" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-amber-50 hover:text-amber-600"><Archive className="h-4 w-4" /></button>
                )}
                <button onClick={() => { if (confirm('Delete this campaign? Leads will be unlinked.')) withErrorHandling(async () => { await deleteCampaign(m.campaign.id); await load(); onLeadsChanged(); }, 'Could not delete this campaign. Please try again.'); }} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Quality badge */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                m.qualityRating === 'Excellent' ? 'bg-emerald-50 text-emerald-700' :
                m.qualityRating === 'Good' ? 'bg-amber-50 text-amber-700' :
                m.qualityRating === 'Average' ? 'bg-orange-50 text-orange-700' :
                'bg-red-50 text-red-600'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  m.qualityRating === 'Excellent' ? 'bg-emerald-500' :
                  m.qualityRating === 'Good' ? 'bg-amber-500' :
                  m.qualityRating === 'Average' ? 'bg-orange-500' :
                  'bg-red-500'
                }`} />
                {m.qualityRating}
              </span>
              <span className="text-[12px] text-gray-400">{m.qualityScore}% quality score</span>
              {m.costPerLead !== null && <span className="text-[12px] text-gray-400">· ₹{m.costPerLead}/lead</span>}
              <span
                title="Quality score = (Hot + Warm + Booked leads ÷ total leads) × 100. 60%+ Excellent, 40%+ Good, 20%+ Average, below Poor."
                className="grid h-4 w-4 shrink-0 cursor-help place-items-center rounded-full text-gray-300 transition hover:text-gray-500"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* Mini KPIs */}
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              <MiniKpi label="Leads" value={m.total} />
              <MiniKpi label="Hot" value={m.hot} />
              <MiniKpi label="Visits" value={m.siteVisitDone} />
              <MiniKpi label="Booked" value={m.bookings} />
            </div>

            {/* Funnel mini bar */}
            <div className="mt-4 space-y-1">
              {[
                { label: 'Leads', value: m.total, color: 'bg-blue-400' },
                { label: 'Contacted', value: m.contacted, color: 'bg-violet-400' },
                { label: 'Calling', value: m.calling, color: 'bg-cyan-400' },
                { label: 'Interested', value: m.interested, color: 'bg-amber-400' },
                { label: 'Site Visits', value: m.siteVisitDone, color: 'bg-teal-400' },
                { label: 'Bookings', value: m.bookings, color: 'bg-emerald-500' },
              ].map((s) => {
                const pct = m.total > 0 ? (s.value / m.total) * 100 : 0;
                return (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[10px] font-medium text-gray-400">{s.label}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full rounded-full ${s.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 shrink-0 text-right text-[10px] font-bold text-gray-600">{s.value}</span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setSelectedCampaign(m.campaign)}
              className="mt-4 w-full rounded-full bg-gray-50 py-2 text-[13px] font-semibold text-emerald-600 transition hover:bg-emerald-50"
            >
              View Details & Funnel
            </button>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      {campaignMetrics.filter((m) => m.total > 0).length > 0 && (
        <div className="mb-6 rounded-2xl border border-black/5 bg-white p-5 card-shadow">
          <h3 className="mb-4 font-display text-base font-bold tracking-tight text-gray-900">Campaign Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-2">Campaign</th>
                  <th className="px-3 py-2">Total Leads</th>
                  <th className="px-3 py-2">Cost/Lead</th>
                  <th className="px-3 py-2">Hot %</th>
                  <th className="px-3 py-2">Calling</th>
                  <th className="px-3 py-2">Visit Rate</th>
                  <th className="px-3 py-2">Booking Rate</th>
                  <th className="px-3 py-2">Quality Score</th>
                  <th className="px-3 py-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {campaignMetrics.filter((m) => m.total > 0).map((m) => (
                  <tr key={m.campaign.id} className="border-t border-gray-100">
                    <td className="px-3 py-2.5 font-semibold text-gray-900">{m.campaign.name}</td>
                    <td className="px-3 py-2.5 text-[13px] text-gray-600">{m.total}</td>
                    <td className="px-3 py-2.5 text-[13px] text-gray-600">{m.costPerLead !== null ? `₹${m.costPerLead}` : '—'}</td>
                    <td className="px-3 py-2.5 text-[13px] text-gray-600">{m.total > 0 ? Math.round((m.hot / m.total) * 100) : 0}%</td>
                    <td className="px-3 py-2.5 text-[13px] text-cyan-600 font-medium">{m.calling}</td>
                    <td className="px-3 py-2.5 text-[13px] text-gray-600">{m.total > 0 ? Math.round((m.siteVisitDone / m.total) * 100) : 0}%</td>
                    <td className="px-3 py-2.5 text-[13px] font-semibold text-emerald-600">{m.conversionRate}%</td>
                    <td className="px-3 py-2.5 text-[13px] font-bold text-gray-900">{m.qualityScore}%</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        m.qualityRating === 'Excellent' ? 'bg-emerald-50 text-emerald-700' :
                        m.qualityRating === 'Good' ? 'bg-amber-50 text-amber-700' :
                        m.qualityRating === 'Average' ? 'bg-orange-50 text-orange-700' :
                        'bg-red-50 text-red-600'
                      }`}>{m.qualityRating}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50/80 font-bold">
                  <td className="px-3 py-2.5 text-gray-900">Total</td>
                  <td className="px-3 py-2.5 text-gray-900">{campaignMetrics.reduce((sum, m) => sum + m.total, 0)}</td>
                  <td colSpan={7} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Comparison chart */}
      {comparisonData.length > 0 && (
        <div className="mb-6 rounded-2xl border border-black/5 bg-white p-5 card-shadow">
          <h3 className="mb-4 font-display text-base font-bold tracking-tight text-gray-900">Leads by Campaign</h3>
          <BarChart data={comparisonData} />
        </div>
      )}

      {/* Lead Status across all campaigns */}
      {dateFilteredLeads.length > 0 && (
        <div className="mb-6 rounded-2xl border border-black/5 bg-white p-5 card-shadow">
          <h3 className="mb-4 font-display text-base font-bold tracking-tight text-gray-900">Lead Status</h3>
          <InteractiveStatusGrid leads={dateFilteredLeads} />
        </div>
      )}

      {/* Campaign detail modal with funnel + timeline */}
      {selectedCampaign && funnel && (
        <CampaignDetailModal
          campaign={selectedCampaign}
          funnel={funnel}
          onClose={() => setSelectedCampaign(null)}
          leadsByCampaign={leadsByCampaign}
        />
      )}

      {/* Create/Edit modal */}
      {(createOpen || editing) && (
        <CampaignModal
          campaign={editing}
          onClose={() => { setCreateOpen(false); setEditing(null); }}
          onSaved={() => { setCreateOpen(false); setEditing(null); load(); onLeadsChanged(); }}
        />
      )}
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 py-2">
      <div className="font-display text-lg font-bold text-gray-900">{value}</div>
      <div className="text-[10px] font-medium text-gray-400">{label}</div>
    </div>
  );
}

function CampaignDetailModal({ campaign, funnel, onClose, leadsByCampaign }: {
  campaign: Campaign;
  funnel: { label: string; value: number; conv: number; dropOff: number }[];
  onClose: () => void;
  leadsByCampaign: Map<string, Lead[]>;
}) {
  const cLeads = leadsByCampaign.get(campaign.id) ?? [];
  const [activeSeg, setActiveSeg] = useState<string | null>(null);
  const segData = useMemo(() => {
    const hot = cLeads.filter((l) => l.status === 'Hot');
    const warm = cLeads.filter((l) => l.status === 'Warm');
    const cold = cLeads.filter((l) => l.status === 'Cold');
    const dead = cLeads.filter((l) => l.status === 'Dead');
    const junk = cLeads.filter((l) => l.status === 'Junk');
    const calling = cLeads.filter((l) => l.status === 'Calling');
    return [
      { label: 'Hot', leads: hot, color: '#ef4444' },
      { label: 'Warm', leads: warm, color: '#f97316' },
      { label: 'Cold', leads: cold, color: '#0ea5e9' },
      { label: 'Calling', leads: calling, color: '#06b6d4' },
      { label: 'Dead', leads: dead, color: '#6b7280' },
      { label: 'Junk', leads: junk, color: '#9ca3af' },
    ];
  }, [cLeads]);
  const activeLeads = activeSeg ? segData.find((s) => s.label === activeSeg)?.leads ?? [] : [];

  const maxValue = Math.max(1, ...funnel.map((f) => f.value));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:animate-scale-in sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">{campaign.name}</h2>
            <p className="text-[12px] text-gray-400">{campaign.type} · {campaign.platform ?? '—'}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Funnel */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Sales Funnel</h3>
            <div className="space-y-2">
              {funnel.map((s, i) => {
                const widthPct = (s.value / maxValue) * 100;
                return (
                  <div key={i}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="font-medium text-gray-600">{s.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{s.value}</span>
                        {i > 0 && <span className="text-gray-400">({s.conv}%)</span>}
                        {i > 0 && s.dropOff > 0 && <span className="text-red-400">−{s.dropOff}%</span>}
                      </span>
                    </div>
                    <div className="h-6 overflow-hidden rounded-lg bg-gray-100">
                      <div className="flex h-full items-center justify-center rounded-lg transition-all duration-500" style={{
                        width: `${Math.max(widthPct, 8)}%`,
                        background: `linear-gradient(90deg, #1f6f43 0%, #155c33 100%)`,
                        opacity: 1 - i * 0.08,
                      }}>
                        <span className="text-[10px] font-bold text-white">{s.value}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lead Status */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Lead Status</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {segData.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setActiveSeg(activeSeg === s.label ? null : s.label)}
                  className={`rounded-xl border p-3 text-center transition ${activeSeg === s.label ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200' : 'border-black/5 bg-gray-50/50 hover:bg-gray-100'}`}
                >
                  <div className="font-display text-xl font-bold" style={{ color: s.color }}>{s.leads.length}</div>
                  <div className="text-[10px] font-medium text-gray-400">{s.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <DonutChart data={segData.filter((s) => s.leads.length > 0).map((s) => ({ label: s.label, value: s.leads.length, color: s.color }))} size={140} />
            </div>
          </div>

          {/* Active segment lead list */}
          {activeSeg && (
            <div className="animate-fade-up">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">{activeSeg} Leads ({activeLeads.length})</h3>
                <button onClick={() => setActiveSeg(null)} className="text-[12px] font-semibold text-gray-400 hover:text-gray-600">Clear</button>
              </div>
              {activeLeads.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-[13px] text-gray-400">No {activeSeg} leads in this campaign.</p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {activeLeads.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-gray-900">{l.name}</p>
                        <p className="text-[11px] text-gray-400">{l.phone}{l.city ? ` · ${l.city}` : ''}</p>
                      </div>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: segData.find((s) => s.label === activeSeg)?.color, backgroundColor: (segData.find((s) => s.label === activeSeg)?.color ?? '#999') + '15' }}>{l.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {campaign.description && (
            <div>
              <h3 className="mb-1 text-sm font-bold text-gray-900">Description</h3>
              <p className="text-[13px] text-gray-600">{campaign.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InteractiveStatusGrid({ leads }: { leads: Lead[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = leads.length;
  const segData = useMemo(() => [
    { label: 'Hot', leads: leads.filter((l) => l.status === 'Hot'), color: '#ef4444' },
    { label: 'Warm', leads: leads.filter((l) => l.status === 'Warm'), color: '#f97316' },
    { label: 'Cold', leads: leads.filter((l) => l.status === 'Cold'), color: '#0ea5e9' },
    { label: 'Calling', leads: leads.filter((l) => l.status === 'Calling'), color: '#06b6d4' },
    { label: 'Dead', leads: leads.filter((l) => l.status === 'Dead'), color: '#6b7280' },
    { label: 'Junk', leads: leads.filter((l) => l.status === 'Junk'), color: '#9ca3af' },
  ], [leads]);
  const activeLeads = active ? segData.find((s) => s.label === active)?.leads ?? [] : [];

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {segData.map((s) => {
          const pct = total > 0 ? Math.round((s.leads.length / total) * 100) : 0;
          return (
            <button
              key={s.label}
              onClick={() => setActive(active === s.label ? null : s.label)}
              className={`rounded-xl border p-3 text-center transition ${active === s.label ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200' : 'border-black/5 bg-gray-50/50 hover:bg-gray-100'}`}
            >
              <div className="font-display text-2xl font-bold" style={{ color: s.color }}>{s.leads.length}</div>
              <div className="text-[11px] font-medium text-gray-400">{s.label}</div>
              <div className="text-[10px] font-bold text-gray-500">{pct}%</div>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <DonutChart data={segData.filter((s) => s.leads.length > 0).map((s) => ({ label: s.label, value: s.leads.length, color: s.color }))} size={160} />
      </div>
      {active && (
        <div className="mt-4 animate-fade-up">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900">{active} Leads ({activeLeads.length})</h4>
            <button onClick={() => setActive(null)} className="text-[12px] font-semibold text-gray-400 hover:text-gray-600">Clear</button>
          </div>
          {activeLeads.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-[13px] text-gray-400">No {active} leads.</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {activeLeads.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-gray-900">{l.name}</p>
                    <p className="text-[11px] text-gray-400">{l.phone}{l.city ? ` · ${l.city}` : ''}</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: segData.find((s) => s.label === active)?.color, backgroundColor: (segData.find((s) => s.label === active)?.color ?? '#999') + '15' }}>{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CampaignModal({ campaign, onClose, onSaved }: {
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CampaignInsert>({
    name: campaign?.name ?? '',
    type: campaign?.type ?? 'Google Search',
    platform: campaign?.platform ?? null,
    start_date: campaign?.start_date ?? null,
    end_date: campaign?.end_date ?? null,
    budget: campaign?.budget ?? null,
    description: campaign?.description ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    if (!form.name.trim()) { setError('Campaign name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const input: CampaignInsert = {
        name: form.name.trim(),
        type: form.type,
        platform: form.platform || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget: form.budget || null,
        description: form.description?.trim() || null,
      };
      if (campaign) await updateCampaign(campaign.id, input);
      else await createCampaign(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:animate-scale-in sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">{campaign ? 'Edit Campaign' : 'New Campaign'}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Campaign Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Google Search – July" className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CampaignType })} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300">
                {CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Platform</label>
              <select value={form.platform ?? ''} onChange={(e) => setForm({ ...form, platform: (e.target.value || null) as CampaignPlatform | null })} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300">
                <option value="">—</option>
                {CAMPAIGN_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Start Date</label>
              <input type="date" value={form.start_date ?? ''} onChange={(e) => setForm({ ...form, start_date: e.target.value || null })} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">End Date</label>
              <input type="date" value={form.end_date ?? ''} onChange={(e) => setForm({ ...form, end_date: e.target.value || null })} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Budget (₹, optional)</label>
            <input type="number" value={form.budget ?? ''} onChange={(e) => setForm({ ...form, budget: e.target.value ? Number(e.target.value) : null })} placeholder="50000" className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Description</label>
            <textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Campaign details…" className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300" />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex gap-3 border-t border-gray-100 bg-white px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-full bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-200">Cancel</button>
          <button onClick={save} disabled={saving} className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full brand-gradient py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60">
            <Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}
