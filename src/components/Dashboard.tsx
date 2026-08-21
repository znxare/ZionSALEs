import { useMemo, useState, useEffect } from 'react';
import {
  CalendarClock, AlertTriangle, Flame, MapPin, CheckCircle2, UserPlus, ArrowRight,
  TrendingUp, Award, Snowflake,
  Phone, MessageCircle, X, ChevronRight, Zap,
} from 'lucide-react';
import type { Lead, Campaign, SiteVisit, ReactivationAttempt } from '@/lib/supabase';
import { isToday, isOverdue, isThisMonth, relativeDay, formatTime, fetchAllSiteVisits, fetchAllReactivationAttempts } from '@/lib/crm';
import { statusStyles } from '@/lib/styles';

interface Props {
  leads: Lead[];
  campaigns: Campaign[];
  loading: boolean;
  onOpenLead: (id: string) => void;
  onAdd: () => void;
  onRefresh?: () => Promise<void>;
}

function FollowUpPopup({ type, leads, onClose, onOpenLead }: {
  type: 'today' | 'overdue';
  leads: Lead[];
  onClose: () => void;
  onOpenLead: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = type === 'today' ? "Today's Follow-ups" : 'Overdue Follow-ups';
  const tint = type === 'today' ? 'orange' : 'red';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:animate-scale-in sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className={'grid h-9 w-9 place-items-center rounded-xl ' + (tint === 'orange' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600')}>
              {type === 'today' ? <CalendarClock className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">{title}</h2>
              <p className="text-[12px] text-gray-400">{leads.length} {leads.length === 1 ? 'lead' : 'leads'} — tap call to dial</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          {leads.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
              <p className="mt-3 text-sm font-medium text-gray-500">All caught up — no {type === 'today' ? 'follow-ups due today' : 'overdue follow-ups'}.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => {
                const ss = statusStyles(lead.status);
                const overdue = type === 'overdue';
                return (
                  <div key={lead.id} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3.5 card-shadow transition hover:shadow-md">
                    <button onClick={() => { onClose(); onOpenLead(lead.id); }} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-gray-900">{lead.name}</span>
                        <span className={'hidden shrink-0 rounded-full ' + ss.bg + ' ' + ss.text + ' px-2 py-0.5 text-[10px] font-medium ring-1 ' + ss.ring + ' sm:inline'}>{lead.status}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[12px] text-gray-400">
                        <span className={'inline-flex items-center gap-1 ' + (overdue ? 'font-semibold text-red-600' : 'text-orange-600')}>
                          <span className={'h-1.5 w-1.5 rounded-full ' + ss.dot} />
                          <span>{overdue ? relativeDay(lead.next_followup_at) : 'Today — ' + formatTime(lead.next_followup_at)}</span>
                        </span>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <a href={'tel:' + lead.phone} title="Call" className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100">
                        <Phone className="h-4 w-4" />
                      </a>
                      <a href={'https://wa.me/' + lead.phone.replace(/\D/g, '')} target="_blank" rel="noreferrer" title="WhatsApp" className="grid h-9 w-9 place-items-center rounded-full bg-green-50 text-green-600 transition hover:bg-green-100">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function isTodayActivity(l: Lead): boolean {
  if (!l.last_activity_at) return false;
  return isToday(l.last_activity_at);
}

export default function Dashboard({ leads, campaigns, loading, onOpenLead, onAdd }: Props) {
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [reactAttempts, setReactAttempts] = useState<ReactivationAttempt[]>([]);
  const [popupType, setPopupType] = useState<'today' | 'overdue' | null>(null);

  useEffect(() => {
    fetchAllSiteVisits().then(setVisits).catch(() => {});
    fetchAllReactivationAttempts().then(setReactAttempts).catch(() => {});
  }, [leads]);

  const reactivationStats = useMemo(() => {
    const coldLeads = leads.filter((l) => l.status === 'Cold');
    const dueToday = coldLeads.filter((l) => l.next_reactivation_at && isToday(l.next_reactivation_at));
    const overdue = coldLeads.filter((l) => l.next_reactivation_at && isOverdue(l.next_reactivation_at) && !isToday(l.next_reactivation_at));
    const reactivatedThisMonth = reactAttempts.filter((a) => a.reactivated && isThisMonth(a.contacted_at));
    const salesFromReactivation = reactAttempts.filter((a) => a.reactivated).filter((a) => {
      const lead = leads.find((l) => l.id === a.lead_id);
      return lead && !!lead.booked_at;
    }).length;
    return { coldCount: coldLeads.length, dueToday: dueToday.length, overdue: overdue.length, reactivatedThisMonth: reactivatedThisMonth.length, salesFromReactivation };
  }, [leads, reactAttempts]);

  const stats = useMemo(() => {
    const today = leads.filter((l) => isToday(l.next_followup_at) && l.status !== 'Dead' && l.status !== 'Junk' && !l.booked_at && !isTodayActivity(l));
    const overdue = leads.filter((l) => isOverdue(l.next_followup_at) && !isToday(l.next_followup_at) && l.status !== 'Dead' && l.status !== 'Junk' && !l.booked_at && !isTodayActivity(l));
    const hot = leads.filter((l) => l.status === 'Hot');
    const warm = leads.filter((l) => l.status === 'Warm');
    const cold = leads.filter((l) => l.status === 'Cold');
    const siteVisitsToday = visits.filter((v) => isToday(v.scheduled_at));
    const nextVisit = visits
      .filter((v) => new Date(v.scheduled_at) >= new Date())
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
    const bookings = leads.filter((l) => l.booked_at && isThisMonth(l.booked_at));
    const newToday = leads.filter((l) => isToday(l.created_at));
    return { today, overdue, hot, warm, cold, siteVisitsToday, nextVisit, bookings, newToday };
  }, [leads, visits]);

  const closeStats = useMemo(() => {
    const sold = leads.filter((l) => !!l.booked_at);
    if (sold.length === 0) return { avg: 0, fastest: 0, longest: 0 };
    const daysArr = sold.map((l) => Math.max(0, Math.round((new Date(l.booked_at!).getTime() - new Date(l.created_at).getTime()) / 86400000)));
    const totalDays = daysArr.reduce((sum, d) => sum + d, 0);
    return { avg: Math.round(totalDays / sold.length), fastest: Math.min(...daysArr), longest: Math.max(...daysArr) };
  }, [leads]);

  const avgVisitsBeforeSale = useMemo(() => {
    const soldLeadIds = new Set(leads.filter((l) => !!l.booked_at).map((l) => l.id));
    if (soldLeadIds.size === 0) return { avg: '0', closedCount: 0, totalVisits: 0 };
    const soldVisits = visits.filter((v) => soldLeadIds.has(v.lead_id));
    return { avg: (soldVisits.length / soldLeadIds.size).toFixed(1), closedCount: soldLeadIds.size, totalVisits: soldVisits.length };
  }, [leads, visits]);

  const execMetrics = useMemo(() => {
    const totalLeads = leads.length;
    const totalSales = leads.filter((l) => !!l.booked_at).length;
    const leadToSaleRate = totalLeads > 0 ? Math.round((totalSales / totalLeads) * 100) : 0;

    const campaignsWithLeads = campaigns.filter((c) => leads.some((l) => l.campaign_id === c.id));
    let bestCampaign = '-';
    let bestRate = 0;
    campaignsWithLeads.forEach((c) => {
      const cLeads = leads.filter((l) => l.campaign_id === c.id);
      const cSold = cLeads.filter((l) => !!l.booked_at);
      const rate = cLeads.length > 0 ? (cSold.length / cLeads.length) * 100 : 0;
      if (rate > bestRate) { bestRate = rate; bestCampaign = c.name; }
    });
    const avgCampaignRate = campaignsWithLeads.length > 0
      ? Math.round(campaignsWithLeads.reduce((sum, c) => {
          const cLeads = leads.filter((l) => l.campaign_id === c.id);
          const cSold = cLeads.filter((l) => !!l.booked_at);
          return sum + (cLeads.length > 0 ? (cSold.length / cLeads.length) * 100 : 0);
        }, 0) / campaignsWithLeads.length)
      : 0;

    return { totalLeads, totalSales, leadToSaleRate, bestCampaign, avgCampaignRate, bestRate };
  }, [leads, campaigns]);

  const priorityList = useMemo(() => {
    const active = leads.filter((l) => l.status !== 'Dead' && l.status !== 'Junk' && !l.booked_at);
    return active.sort((a, b) => {
      const ao = isOverdue(a.next_followup_at) ? 0 : 1;
      const bo = isOverdue(b.next_followup_at) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const statusRank = (s: string) => s === 'Hot' ? 0 : s === 'Warm' ? 1 : s === 'Calling' ? 2 : 3;
      const ap = statusRank(a.status);
      const bp = statusRank(b.status);
      if (ap !== bp) return ap - bp;
      return new Date(a.next_followup_at ?? 0).getTime() - new Date(b.next_followup_at ?? 0).getTime();
    }).slice(0, 8);
  }, [leads]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-200 border-t-orange-600" />
        <p className="mt-3 text-sm text-gray-400">Loading your day…</p>
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const totalAttention = stats.overdue.length + stats.today.length;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Orange ribbon hero — full-width brand banner */}
      <div className="overflow-hidden rounded-3xl brand-gradient p-6 text-white card-shadow-lg sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-orange-100/80">{greeting}, sales team.</p>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {totalAttention > 0
                ? totalAttention + ' follow-up' + (totalAttention === 1 ? '' : 's') + ' need your attention'
                : 'You are all caught up'}
            </h1>
            <p className="mt-1 text-sm text-orange-100/70">
              {totalAttention > 0 ? 'Here is your priority work for today.' : 'No pending follow-ups. Add a new lead to get started.'}
            </p>
            {/* Priority breakdown chips on the ribbon */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
                {stats.overdue.length} Overdue
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
                <Flame className="h-3 w-3" />
                {stats.hot.length} Hot
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                {stats.warm.length} Warm
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
                <Snowflake className="h-3 w-3" />
                {stats.cold.length} Cold
              </span>
            </div>
          </div>
          {totalAttention > 0 && (
            <button
              onClick={() => setPopupType(stats.overdue.length > 0 ? 'overdue' : 'today')}
              className="group inline-flex items-center gap-2 self-start rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-orange-700 shadow-md transition hover:bg-orange-50 sm:self-auto"
            >
              <Zap className="h-4 w-4" />
              View Priority Leads
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPI cards — semantic color hierarchy */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Overdue — red/critical */}
        <button onClick={() => setPopupType('overdue')} className="group text-left">
          <div className="rounded-2xl border border-red-200/60 bg-gradient-to-br from-red-50/60 to-white p-4 card-shadow transition hover:shadow-md hover:border-red-300/60">
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-600 shadow-sm">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <span className="font-display text-2xl font-bold tracking-tight text-gray-900">{stats.overdue.length}</span>
            </div>
            <div className="mt-3 text-[13px] font-medium text-gray-600">Overdue Follow-ups</div>
          </div>
        </button>

        {/* Today's follow-ups — orange/primary action */}
        <button onClick={() => setPopupType('today')} className="group text-left">
          <div className="rounded-2xl border border-orange-200/60 bg-gradient-to-br from-orange-50/60 to-white p-4 card-shadow transition hover:shadow-md hover:border-orange-300/60">
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100 text-orange-600 shadow-sm">
                <CalendarClock className="h-5 w-5" />
              </div>
              <span className="font-display text-2xl font-bold tracking-tight text-gray-900">{stats.today.length}</span>
            </div>
            <div className="mt-3 text-[13px] font-medium text-gray-600">Today's Follow-ups</div>
          </div>
        </button>

        {/* Hot leads — amber/attention */}
        <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/60 to-white p-4 card-shadow transition hover:shadow-md hover:border-amber-300/60">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-600 shadow-sm">
              <Flame className="h-5 w-5" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-gray-900">{stats.hot.length}</span>
          </div>
          <div className="mt-3 text-[13px] font-medium text-gray-600">Hot Leads</div>
        </div>

        {/* Site visits — blue/scheduled */}
        <div className="rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50/60 to-white p-4 card-shadow transition hover:shadow-md hover:border-blue-300/60">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-600 shadow-sm">
              <MapPin className="h-5 w-5" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-gray-900">{stats.siteVisitsToday.length}</span>
          </div>
          <div className="mt-3 text-[13px] font-medium text-gray-600">
            {stats.siteVisitsToday.length > 0
              ? 'Site Visits Today'
              : stats.nextVisit
                ? 'Next: ' + relativeDay(stats.nextVisit.scheduled_at)
                : 'No Visits Scheduled'}
          </div>
        </div>
      </div>

      {/* Secondary KPI row — smaller, less prominent */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-white p-3.5 card-shadow transition hover:shadow-md">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-600 shadow-sm">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="font-display text-lg font-bold text-gray-900">{stats.bookings.length}</div>
              <div className="text-[11px] font-medium text-gray-500">Bookings This Month</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200/60 bg-gradient-to-br from-gray-50/50 to-white p-3.5 card-shadow transition hover:shadow-md">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100 text-gray-500 shadow-sm">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <div className="font-display text-lg font-bold text-gray-900">{stats.newToday.length}</div>
              <div className="text-[11px] font-medium text-gray-500">New Leads Today</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-sky-200/50 bg-gradient-to-br from-sky-50/50 to-white p-3.5 card-shadow transition hover:shadow-md">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-100 text-sky-600 shadow-sm">
              <Snowflake className="h-4 w-4" />
            </div>
            <div>
              <div className="font-display text-lg font-bold text-gray-900">{reactivationStats.dueToday + reactivationStats.overdue}</div>
              <div className="text-[11px] font-medium text-gray-500">Reactivations Due</div>
            </div>
          </div>
        </div>
      </div>

      {/* Priority leads — action list with quick call/WhatsApp */}
      <div>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">Next to contact</h2>
            <p className="text-[13px] text-gray-400">Your highest-priority follow-ups, sorted for you.</p>
          </div>
          {priorityList.length === 8 && (
            <a href="#/planner" className="text-[13px] font-semibold text-orange-600 hover:text-orange-700">
              Day Planner →
            </a>
          )}
        </div>

        {priorityList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <p className="text-sm font-medium text-gray-500">No active follow-ups right now.</p>
            <button
              onClick={onAdd}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full brand-gradient px-4 py-2 text-sm font-semibold text-white"
            >
              <UserPlus className="h-4 w-4" /> Add your first lead
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200/60 surface-warm card-shadow">
            {priorityList.map((lead, i) => {
              const overdue = isOverdue(lead.next_followup_at) && !isToday(lead.next_followup_at);
              const today = isToday(lead.next_followup_at);
              const ss = statusStyles(lead.status);
              const accentBar = overdue ? 'bg-red-500' : today ? 'bg-orange-500' : lead.status === 'Hot' ? 'bg-amber-500' : lead.status === 'Cold' ? 'bg-sky-400' : 'bg-gray-300';

              return (
                <div
                  key={lead.id}
                  className={'group flex w-full items-center gap-3 px-4 py-3.5 transition hover:bg-gray-50/60 ' + (i !== 0 ? 'border-t border-gray-100' : '')}
                >
                  <span className={'h-8 w-1 shrink-0 rounded-full ' + accentBar} />
                  <button onClick={() => onOpenLead(lead.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-gray-900">{lead.name}</span>
                      <span className={'hidden shrink-0 rounded-full ' + ss.bg + ' ' + ss.text + ' px-2 py-0.5 text-[11px] font-medium ring-1 ' + ss.ring + ' sm:inline'}>
                        {lead.status}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-gray-400">
                      <span className={'inline-flex items-center gap-1 ' + (overdue ? 'font-semibold text-red-600' : '')}>
                        <span className={'h-1.5 w-1.5 rounded-full ' + ss.dot} />
                        {overdue ? relativeDay(lead.next_followup_at) : today ? 'Today, ' + formatTime(lead.next_followup_at) : relativeDay(lead.next_followup_at)}
                      </span>
                      {lead.site_visit_at && isToday(lead.site_visit_at) && (
                        <span className="inline-flex items-center gap-1 text-blue-600">
                          <MapPin className="h-3 w-3" /> Site visit today
                        </span>
                      )}
                    </div>
                  </button>
                  {/* Quick actions — visible on hover for desktop, always on mobile */}
                  <div className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <a href={'tel:' + lead.phone} title="Call" className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100">
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                    <a href={'https://wa.me/' + lead.phone.replace(/\D/g, '')} target="_blank" rel="noreferrer" title="WhatsApp" className="grid h-8 w-8 place-items-center rounded-full bg-green-50 text-green-600 transition hover:bg-green-100">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                    <button onClick={() => onOpenLead(lead.id)} className="grid h-8 w-8 place-items-center rounded-full bg-gray-50 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Performance + Reactivation — combined section */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sales performance */}
        <div className="rounded-2xl border border-gray-200/60 surface-warm p-5 card-shadow">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-600 shadow-sm">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3 className="font-display text-base font-bold tracking-tight text-gray-900">Sales Performance</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <div className="font-display text-xl font-bold text-gray-900">{execMetrics.totalLeads}</div>
              <div className="text-[11px] font-medium text-gray-400">Total Leads</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold text-emerald-600">{execMetrics.totalSales}</div>
              <div className="text-[11px] font-medium text-gray-400">Total Sales</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold text-gray-900">{execMetrics.leadToSaleRate}%</div>
              <div className="text-[11px] font-medium text-gray-400">Lead-to-Sale Rate</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold text-gray-900">{avgVisitsBeforeSale.avg}</div>
              <div className="text-[11px] font-medium text-gray-400">Avg Visits / Sale</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold text-gray-900">{closeStats.avg > 0 ? closeStats.avg + 'd' : '—'}</div>
              <div className="text-[11px] font-medium text-gray-400">Avg Time to Close</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold text-gray-900">{execMetrics.avgCampaignRate}%</div>
              <div className="text-[11px] font-medium text-gray-400">Campaign Conv. Rate</div>
            </div>
          </div>
          {execMetrics.bestCampaign !== '-' && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-purple-50/60 px-3 py-2 ring-1 ring-purple-200/50">
              <Award className="h-4 w-4 text-purple-600" />
              <span className="text-[12px] font-medium text-gray-600">Best: <span className="font-semibold text-gray-900">{execMetrics.bestCampaign}</span> ({Math.round(execMetrics.bestRate)}% conv.)</span>
            </div>
          )}
        </div>

        {/* Lead Reactivation */}
        <div className="rounded-2xl border border-sky-200/50 bg-gradient-to-br from-sky-50/40 to-white p-5 card-shadow">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-100 text-sky-600 shadow-sm">
              <Snowflake className="h-4 w-4" />
            </div>
            <h3 className="font-display text-base font-bold tracking-tight text-gray-900">Lead Reactivation</h3>
            <a href="#/reactivation" className="ml-auto text-[12px] font-semibold text-orange-600 hover:text-orange-700">View all →</a>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <div className="font-display text-xl font-bold text-sky-600">{reactivationStats.coldCount}</div>
              <div className="text-[11px] font-medium text-gray-400">Cold Leads</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold text-orange-600">{reactivationStats.dueToday}</div>
              <div className="text-[11px] font-medium text-gray-400">Due Today</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold text-red-600">{reactivationStats.overdue}</div>
              <div className="text-[11px] font-medium text-gray-400">Overdue</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold text-emerald-600">{reactivationStats.reactivatedThisMonth}</div>
              <div className="text-[11px] font-medium text-gray-400">Reactivated (Month)</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold text-amber-600">{reactivationStats.salesFromReactivation}</div>
              <div className="text-[11px] font-medium text-gray-400">Sales from Reactivation</div>
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up popup */}
      {popupType && (
        <FollowUpPopup
          type={popupType}
          leads={popupType === 'today' ? stats.today : stats.overdue}
          onClose={() => setPopupType(null)}
          onOpenLead={onOpenLead}
        />
      )}
    </div>
  );
}
