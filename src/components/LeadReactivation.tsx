import { useEffect, useMemo, useState } from 'react';
import {
  Snowflake, Phone, MessageCircle, Mail, Eye, RefreshCw, CalendarClock,
  AlertTriangle, TrendingUp, CheckCircle2, Clock, Target, Flame,
  ChevronDown, ChevronUp, X, Lightbulb, Filter,
} from 'lucide-react';
import type { Lead, Campaign, SiteVisit, ColdReason, ReactivationOutcome, ReactivationAttempt } from '@/lib/supabase';
import {
  fetchAllSiteVisits, fetchAllReactivationAttempts, reactivateLead,
  isToday, isThisWeek, isThisMonth, isOverdue, formatDate, formatDateTime,
  COLD_REASONS, REACTIVATION_OUTCOMES, REASON_SUGGESTIONS,
} from '@/lib/crm';
import { BarChart, DonutChart } from './charts';

interface Props {
  leads: Lead[];
  campaigns: Campaign[];
  onOpenLead: (id: string) => void;
  onChanged: () => void;
}

type PeriodFilter = 'month' | 'quarter' | 'year' | 'all';

export default function LeadReactivation({ leads, campaigns, onOpenLead, onChanged }: Props) {
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [attempts, setAttempts] = useState<ReactivationAttempt[]>([]);
  const [reactivateFor, setReactivateFor] = useState<Lead | null>(null);
  const [reactivateError, setReactivateError] = useState<string | null>(null);
  const [reasonFilter, setReasonFilter] = useState<ColdReason | 'all'>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [showCampaignInsights, setShowCampaignInsights] = useState(false);

  useEffect(() => {
    Promise.all([fetchAllSiteVisits(), fetchAllReactivationAttempts()])
      .then(([v, a]) => { setVisits(v); setAttempts(a); })
      .catch(() => {});
  }, [leads]);

  const campaignMap = useMemo(() => {
    const m = new Map<string, Campaign>();
    campaigns.forEach((c) => m.set(c.id, c));
    return m;
  }, [campaigns]);

  const coldLeads = useMemo(() => leads.filter((l) => l.status === 'Cold'), [leads]);

  // KPI cards
  const kpis = useMemo(() => {
    const today = coldLeads.filter((l) => l.next_reactivation_at && isToday(l.next_reactivation_at));
    const thisWeek = coldLeads.filter((l) => l.next_reactivation_at && isThisWeek(l.next_reactivation_at));
    const overdue = coldLeads.filter((l) => l.next_reactivation_at && isOverdue(l.next_reactivation_at) && !isToday(l.next_reactivation_at));
    const reactivatedThisMonth = attempts.filter((a) => a.reactivated && isThisMonth(a.contacted_at));
    const reactivatedTotal = attempts.filter((a) => a.reactivated).length;
    const successRate = attempts.length > 0 ? Math.round((reactivatedTotal / attempts.length) * 100) : 0;
    const avgDays = coldLeads.length > 0 && coldLeads.some((l) => l.cold_since)
      ? Math.round(coldLeads.filter((l) => l.cold_since).reduce((sum, l) => sum + Math.max(0, Math.round((Date.now() - new Date(l.cold_since!).getTime()) / 86400000)), 0) / Math.max(1, coldLeads.filter((l) => l.cold_since).length))
      : 0;
    return { total: coldLeads.length, today: today.length, thisWeek: thisWeek.length, overdue: overdue.length, reactivatedThisMonth: reactivatedThisMonth.length, successRate, avgDays };
  }, [coldLeads, attempts]);

  // Priority queue: sort by reactivation due date, visits, calls, engagement
  const priorityQueue = useMemo(() => {
    const filtered = coldLeads.filter((l) => {
      if (reasonFilter !== 'all' && l.cold_reason !== reasonFilter) return false;
      if (campaignFilter !== 'all' && l.campaign_id !== campaignFilter) return false;
      return true;
    });

    return filtered.map((l) => {
      const leadVisits = visits.filter((v) => v.lead_id === l.id);
      const leadAttempts = attempts.filter((a) => a.lead_id === l.id);
      const callCount = leadAttempts.length;
      const visitCount = leadVisits.length;
      const daysSinceContact = l.last_contacted_at ? Math.round((Date.now() - new Date(l.last_contacted_at).getTime()) / 86400000) : 999;
      const overdueDays = l.next_reactivation_at ? Math.max(0, Math.round((Date.now() - new Date(l.next_reactivation_at).getTime()) / 86400000)) : 0;

      // Priority score: higher = more urgent
      const score = overdueDays * 10 + visitCount * 5 + callCount * 3 + Math.min(daysSinceContact, 100) * 0.5;
      return { lead: l, visitCount, callCount, daysSinceContact, overdueDays, score };
    }).sort((a, b) => b.score - a.score);
  }, [coldLeads, visits, attempts, reasonFilter, campaignFilter]);

  // Analytics: cold reasons distribution
  const reasonDistribution = useMemo(() => {
    const palette = ['#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#ef4444', '#eab308', '#06b6d4', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16', '#a855f7', '#64748b'];
    const counts = new Map<string, number>();
    coldLeads.forEach((l) => {
      const r = l.cold_reason ?? 'Other';
      counts.set(r, (counts.get(r) ?? 0) + 1);
    });
    return COLD_REASONS.filter((r) => counts.has(r)).map((r, i) => ({ label: r, value: counts.get(r)!, color: palette[i % palette.length] }));
  }, [coldLeads]);

  // Analytics: reactivation success funnel
  const reactivationFunnel = useMemo(() => {
    const contacted = attempts.length;
    const warmAgain = attempts.filter((a) => a.reactivated).length;
    const siteVisitsAfter = attempts.filter((a) => a.reactivated).filter((a) => {
      const lead = leads.find((l) => l.id === a.lead_id);
      return lead && visits.some((v) => v.lead_id === lead.id && new Date(v.scheduled_at) > new Date(a.contacted_at));
    }).length;
    const salesAfter = attempts.filter((a) => a.reactivated).filter((a) => {
      const lead = leads.find((l) => l.id === a.lead_id);
      return lead && !!lead.booked_at;
    }).length;
    const conversionRate = contacted > 0 ? Math.round((warmAgain / contacted) * 100) : 0;
    return { contacted, warmAgain, siteVisitsAfter, salesAfter, conversionRate };
  }, [attempts, leads, visits]);

  // Monthly trend (period-filtered)
  const trendData = useMemo(() => {
    const now = new Date();
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString('en', { month: 'short' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      });
    }

    return months.map((m) => {
      const coldAdded = coldLeads.filter((l) => l.cold_since && new Date(l.cold_since) >= m.start && new Date(l.cold_since) <= m.end).length;
      const reactivated = attempts.filter((a) => a.reactivated && new Date(a.contacted_at) >= m.start && new Date(a.contacted_at) <= m.end).length;
      const visitsGenerated = attempts.filter((a) => a.reactivated && new Date(a.contacted_at) >= m.start && new Date(a.contacted_at) <= m.end)
        .filter((a) => {
          const lead = leads.find((l) => l.id === a.lead_id);
          return lead && visits.some((v) => v.lead_id === lead.id && new Date(v.scheduled_at) > new Date(a.contacted_at));
        }).length;
      const salesGenerated = attempts.filter((a) => a.reactivated && new Date(a.contacted_at) >= m.start && new Date(a.contacted_at) <= m.end)
        .filter((a) => {
          const lead = leads.find((l) => l.id === a.lead_id);
          return lead && !!lead.booked_at;
        }).length;
      return { label: m.label, coldAdded, reactivated, visitsGenerated, salesGenerated };
    });
  }, [coldLeads, attempts, leads, visits, period]);

  // Campaign insights
  const campaignInsights = useMemo(() => {
    return campaigns.map((c) => {
      const cCold = coldLeads.filter((l) => l.campaign_id === c.id);
      const cColdIds = new Set(cCold.map((l) => l.id));
      const cReactivated = attempts.filter((a) => a.reactivated && cColdIds.has(a.lead_id)).length;
      const cVisitsAfter = attempts.filter((a) => a.reactivated && cColdIds.has(a.lead_id))
        .filter((a) => visits.some((v) => v.lead_id === a.lead_id && new Date(v.scheduled_at) > new Date(a.contacted_at))).length;
      const cSalesAfter = coldLeads.filter((l) => l.campaign_id === c.id && !!l.booked_at).length;
      return { campaign: c, coldCount: cCold.length, reactivated: cReactivated, visitsAfter: cVisitsAfter, salesAfter: cSalesAfter };
    }).filter((c) => c.coldCount > 0).sort((a, b) => b.coldCount - a.coldCount);
  }, [campaigns, coldLeads, attempts, visits]);

  async function handleReactivate(outcome: ReactivationOutcome, notes?: string) {
    if (!reactivateFor) return;
    setReactivateError(null);
    try {
      await reactivateLead(reactivateFor, outcome, notes);
      setReactivateFor(null);
      onChanged();
    } catch (e) {
      setReactivateError(e instanceof Error ? e.message : 'Could not save this reactivation. Please try again.');
      throw e;
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600">
            <Snowflake className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Lead Reactivation Center</h1>
            <p className="text-[13px] text-gray-400">Systematically convert yesterday's lost opportunities into tomorrow's sales.</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard icon={Snowflake} label="Total Cold Leads" value={kpis.total} tint="bg-sky-50 text-sky-700" />
        <KpiCard icon={CalendarClock} label="Due Today" value={kpis.today} tint="bg-orange-50 text-orange-700" />
        <KpiCard icon={CalendarClock} label="Due This Week" value={kpis.thisWeek} tint="bg-amber-50 text-amber-700" />
        <KpiCard icon={AlertTriangle} label="Overdue" value={kpis.overdue} tint="bg-red-50 text-red-700" />
        <KpiCard icon={TrendingUp} label="Reactivated (Month)" value={kpis.reactivatedThisMonth} tint="bg-emerald-50 text-emerald-700" />
        <KpiCard icon={Target} label="Success Rate" value={`${kpis.successRate}%`} tint="bg-violet-50 text-violet-700" />
        <KpiCard icon={Clock} label="Avg Days in Cold" value={kpis.avgDays} tint="bg-gray-100 text-gray-700" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value as ColdReason | 'all')}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
          >
            <option value="all">All Reasons</option>
            {COLD_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
        >
          <option value="all">All Campaigns</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-[12px] text-gray-400">{priorityQueue.length} cold leads</span>
      </div>

      {/* Priority Queue Table */}
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">City</th>
                <th className="hidden px-4 py-3 font-semibold xl:table-cell">Campaign</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Cold Reason</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Marked Cold</th>
                <th className="px-4 py-3 font-semibold">Days</th>
                <th className="hidden px-4 py-3 font-semibold xl:table-cell">Last Contact</th>
                <th className="px-4 py-3 font-semibold">Next React.</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Visits</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {priorityQueue.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-400">
                    No cold leads match your filters. Active leads are clean and focused.
                  </td>
                </tr>
              ) : priorityQueue.map(({ lead, visitCount, callCount, overdueDays }) => {
                const daysInCold = lead.cold_since ? Math.max(0, Math.round((Date.now() - new Date(lead.cold_since).getTime()) / 86400000)) : 0;
                const isOverdueRow = lead.next_reactivation_at && isOverdue(lead.next_reactivation_at);
                const isTodayRow = lead.next_reactivation_at && isToday(lead.next_reactivation_at);
                return (
                  <tr key={lead.id} className="group transition hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <button onClick={() => onOpenLead(lead.id)} className="font-semibold text-gray-900 hover:text-orange-600">
                        {lead.name}
                      </button>
                      {overdueDays > 0 && <span className="ml-2 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600">OVERDUE</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{lead.phone}</td>
                    <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">{lead.city ?? '—'}</td>
                    <td className="hidden px-4 py-3 text-gray-600 xl:table-cell">{lead.campaign_id ? (campaignMap.get(lead.campaign_id)?.name ?? '—') : '—'}</td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">{lead.cold_reason ?? '—'}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-[12px] text-gray-500 lg:table-cell">{lead.cold_since ? formatDate(lead.cold_since) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${daysInCold > 180 ? 'text-red-600' : daysInCold > 90 ? 'text-orange-600' : 'text-gray-700'}`}>{daysInCold}d</span>
                    </td>
                    <td className="hidden px-4 py-3 text-[12px] text-gray-500 xl:table-cell">{lead.last_contacted_at ? formatDate(lead.last_contacted_at) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[12px] font-medium ${isOverdueRow ? 'text-red-600' : isTodayRow ? 'text-orange-600' : 'text-gray-600'}`}>
                        {lead.next_reactivation_at ? formatDate(lead.next_reactivation_at) : '—'}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">{visitCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <ActionBtn icon={Phone} title="Call" tint="text-emerald-600 hover:bg-emerald-50" onClick={() => window.location.href = `tel:${lead.phone}`} />
                        <ActionBtn icon={MessageCircle} title="WhatsApp" tint="text-green-600 hover:bg-green-50" onClick={() => window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}`, '_blank')} />
                        <ActionBtn icon={Mail} title="Email" tint="text-blue-600 hover:bg-blue-50" onClick={() => lead.email && (window.location.href = `mailto:${lead.email}`)} />
                        <ActionBtn icon={Eye} title="View" tint="text-gray-600 hover:bg-gray-100" onClick={() => onOpenLead(lead.id)} />
                        <ActionBtn icon={RefreshCw} title="Reactivate" tint="text-sky-600 hover:bg-sky-50" onClick={() => setReactivateFor(lead)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Cold Reasons Distribution */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
          <h3 className="mb-4 font-display text-base font-bold tracking-tight text-gray-900">Cold Reasons Distribution</h3>
          {reasonDistribution.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No cold leads yet.</p>
          ) : (
            <>
              <DonutChart data={reasonDistribution} size={180} />
              <div className="mt-4 space-y-1.5">
                {reasonDistribution.sort((a, b) => b.value - a.value).map((r) => (
                  <div key={r.label} className="flex items-center justify-between text-[12px]">
                    <span className="text-gray-600">{r.label}</span>
                    <span className="font-semibold text-gray-900">{r.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Reactivation Success */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
          <h3 className="mb-4 font-display text-base font-bold tracking-tight text-gray-900">Reactivation Success</h3>
          <div className="grid grid-cols-2 gap-3">
            <FunnelCard label="Contacted" value={reactivationFunnel.contacted} icon={Phone} tint="bg-sky-50 text-sky-700" />
            <FunnelCard label="Warm Again" value={reactivationFunnel.warmAgain} icon={TrendingUp} tint="bg-emerald-50 text-emerald-700" />
            <FunnelCard label="Site Visits" value={reactivationFunnel.siteVisitsAfter} icon={Eye} tint="bg-violet-50 text-violet-700" />
            <FunnelCard label="Sales Closed" value={reactivationFunnel.salesAfter} icon={CheckCircle2} tint="bg-orange-50 text-orange-700" />
          </div>
          <div className="mt-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 text-center">
            <p className="text-[12px] font-medium text-emerald-600">Reactivation Conversion Rate</p>
            <p className="mt-1 font-display text-3xl font-bold text-emerald-700">{reactivationFunnel.conversionRate}%</p>
          </div>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold tracking-tight text-gray-900">Monthly Reactivation Trend</h3>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
            {(['month', 'quarter', 'year', 'all'] as PeriodFilter[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1 text-[11px] font-semibold capitalize transition ${period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <BarChart
          data={trendData.map((t) => ({
            label: t.label,
            value: t.coldAdded + t.reactivated + t.visitsGenerated + t.salesGenerated,
          }))}
          height={220}
          color="#0ea5e9"
        />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {trendData.length > 0 && (
            <>
              <TrendLegend label="Cold Added" value={trendData.reduce((s, t) => s + t.coldAdded, 0)} color="bg-sky-400" />
              <TrendLegend label="Reactivated" value={trendData.reduce((s, t) => s + t.reactivated, 0)} color="bg-emerald-400" />
              <TrendLegend label="Visits Generated" value={trendData.reduce((s, t) => s + t.visitsGenerated, 0)} color="bg-violet-400" />
              <TrendLegend label="Sales Generated" value={trendData.reduce((s, t) => s + t.salesGenerated, 0)} color="bg-orange-400" />
            </>
          )}
        </div>
      </div>

      {/* Campaign Insights */}
      <div className="rounded-2xl border border-black/5 bg-white card-shadow">
        <button
          onClick={() => setShowCampaignInsights((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4"
        >
          <h3 className="font-display text-base font-bold tracking-tight text-gray-900">Campaign Insights — Cold Lead ROI</h3>
          {showCampaignInsights ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </button>
        {showCampaignInsights && (
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Campaign</th>
                  <th className="px-5 py-3 font-semibold">Cold Leads</th>
                  <th className="px-5 py-3 font-semibold">Reactivated</th>
                  <th className="px-5 py-3 font-semibold">Visits After</th>
                  <th className="px-5 py-3 font-semibold">Sales After</th>
                  <th className="px-5 py-3 font-semibold">Revival Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaignInsights.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400">No campaign data yet.</td></tr>
                ) : campaignInsights.map((c) => {
                  const rate = c.coldCount > 0 ? Math.round((c.reactivated / c.coldCount) * 100) : 0;
                  return (
                    <tr key={c.campaign.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3 font-semibold text-gray-900">{c.campaign.name}</td>
                      <td className="px-5 py-3 text-gray-600">{c.coldCount}</td>
                      <td className="px-5 py-3 text-emerald-600 font-semibold">{c.reactivated}</td>
                      <td className="px-5 py-3 text-violet-600">{c.visitsAfter}</td>
                      <td className="px-5 py-3 text-orange-600 font-semibold">{c.salesAfter}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-[12px] font-semibold text-gray-700">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reactivate Modal */}
      {reactivateFor && (
        <ReactivateModal
          lead={reactivateFor}
          error={reactivateError}
          onClose={() => { setReactivateFor(null); setReactivateError(null); }}
          onConfirm={handleReactivate}
        />
      )}
    </div>
  );
}

// ---------- subcomponents ----------

function KpiCard({ icon: Icon, label, value, tint }: { icon: typeof Snowflake; label: string; value: number | string; tint: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 card-shadow transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${tint}`}><Icon className="h-4.5 w-4.5" /></div>
        <span className="font-display text-xl font-bold tracking-tight text-gray-900">{value}</span>
      </div>
      <div className="mt-2.5 text-[11px] font-medium text-gray-500">{label}</div>
    </div>
  );
}

function ActionBtn({ icon: Icon, title, tint, onClick }: { icon: typeof Phone; title: string; tint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} className={`rounded-lg p-1.5 text-gray-400 transition hover:${tint}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function FunnelCard({ label, value, icon: Icon, tint }: { label: string; value: number; icon: typeof Phone; tint: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-gray-50/50 p-3">
      <div className="flex items-center gap-2">
        <div className={`grid h-7 w-7 place-items-center rounded-lg ${tint}`}><Icon className="h-4 w-4" /></div>
        <span className="font-display text-xl font-bold text-gray-900">{value}</span>
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-gray-400">{label}</p>
    </div>
  );
}

function TrendLegend({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-[11px] font-medium text-gray-500">{label}</span>
      <span className="ml-auto font-bold text-gray-900">{value}</span>
    </div>
  );
}

function ReactivateModal({ lead, error, onClose, onConfirm }: {
  lead: Lead;
  error: string | null;
  onClose: () => void;
  onConfirm: (outcome: ReactivationOutcome, notes?: string) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState<ReactivationOutcome | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestions = lead.cold_reason ? REASON_SUGGESTIONS[lead.cold_reason as ColdReason] ?? [] : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function confirm() {
    if (!outcome) return;
    setSaving(true);
    try {
      await onConfirm(outcome as ReactivationOutcome, notes || undefined);
    } catch {
      /* error is surfaced via the `error` prop by the parent */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:animate-scale-in sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">Reactivate {lead.name}</h2>
              <p className="text-[12px] text-gray-400">What happened after contacting the customer?</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {/* Smart Suggestions */}
          {suggestions.length > 0 && (
            <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <p className="text-[12px] font-semibold uppercase tracking-wide text-amber-700">Smart Suggestions for "{lead.cold_reason}"</p>
              </div>
              <ul className="mt-2 space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-amber-800">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Outcome</label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {REACTIVATION_OUTCOMES.map((o) => {
                const interested = o === 'Interested Again' || o === 'Wants Site Visit' || o === 'Requested More Information';
                return (
                  <button
                    key={o}
                    onClick={() => setOutcome(o)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-[12px] font-medium transition ${outcome === o ? (interested ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-800') : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add notes about this reactivation attempt…"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sky-300"
            />
          </div>

          {outcome && (outcome === 'Interested Again' || outcome === 'Wants Site Visit' || outcome === 'Requested More Information') && (
            <div className="rounded-xl bg-emerald-50 p-3 text-[12px] text-emerald-700">
              This lead will be moved to <strong>Warm</strong>, a follow-up will be created, and the lead will return to the active sales pipeline.
            </div>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-gray-100 bg-white px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-full bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!outcome || saving}
            className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full bg-sky-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> {saving ? 'Saving…' : 'Record Reactivation'}
          </button>
        </div>
      </div>
    </div>
  );
}
