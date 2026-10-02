import { useEffect, useMemo, useState } from 'react';
import {
  FileBarChart, Download, Users, TrendingUp, Megaphone, Loader2, AlarmClock, PhoneOff, Snowflake, LayoutList,
} from 'lucide-react';
import type { Lead, Campaign, SiteVisit, ActivityType, LeadStatus, Profile } from '@/lib/supabase';
import {
  fetchActivitiesBetween, fetchAllSiteVisits, formatDate, formatDateTime, STATUSES, UNASSIGNED_CAMPAIGN_LABEL,
} from '@/lib/crm';
import { fetchHospitalityActivitiesBetween, type HospitalityLead } from '@/lib/hospitality';

type Vertical = 'all' | 'realestate' | 'hospitality';
type RangePreset = 'this_month' | 'last_month' | 'last_30' | 'last_90' | 'this_year' | 'custom';
type Tab = 'overview' | 'followups' | 'uncontacted' | 'cold';

interface Props {
  leads: Lead[];
  hospitalityLeads: HospitalityLead[];
  campaigns: Campaign[];
  profiles: Profile[];
  onOpenCampaigns: () => void;
  onOpenLead: (vertical: 'Real Estate' | 'Hospitality', id: string) => void;
}

const RANGE_LABELS: Record<RangePreset, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_30: 'Last 30 days',
  last_90: 'Last 90 days',
  this_year: 'This year',
  custom: 'Custom',
};

const DAY = 86400000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function rangeFor(preset: RangePreset, customStart: string, customEnd: string): { start: Date; end: Date } {
  const now = new Date();
  const endOfToday = endOfDay(now);
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

type VerticalName = 'Real Estate' | 'Hospitality';

// One activity row from either vertical, normalised for the reports.
interface ReportActivity {
  vertical: VerticalName;
  leadId: string;
  type: ActivityType;
  summary: string;
  meta: Record<string, unknown> | null;
  actor: string;
  created_at: string;
}

interface ReportLead {
  vertical: VerticalName;
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
  last_activity_at: string | null;
  booked_at: string | null;
  cold_reason: string | null;
  cold_since: string | null;
  created_at: string;
}

// Contact actions: these complete a follow-up and count as "contacted".
const CONTACT_TYPES: ActivityType[] = ['Called', 'No Answer', 'WhatsApp Sent', 'Note Added'];
const REACHED_OUT_TYPES: ActivityType[] = ['Called', 'No Answer', 'WhatsApp Sent'];

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

const OVERDUE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '1–3 days', min: 1, max: 3 },
  { label: '4–7 days', min: 4, max: 7 },
  { label: '8–14 days', min: 8, max: 14 },
  { label: '15+ days', min: 15, max: Infinity },
];

function inRange(iso: string | null, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function daysSince(iso: string, now = new Date()): number {
  return Math.floor((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / DAY);
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
}

function isActive(l: ReportLead): boolean {
  return l.status !== 'Dead' && l.status !== 'Junk' && !l.booked_at;
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

export default function Reports({ leads, hospitalityLeads, campaigns, profiles, onOpenCampaigns, onOpenLead }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [vertical, setVertical] = useState<Vertical>('all');
  const [preset, setPreset] = useState<RangePreset>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [neglectDays, setNeglectDays] = useState(14);
  const [rawActivities, setRawActivities] = useState<(Omit<ReportActivity, 'actor'> & { actorId: string | null; actorName: string | null })[]>([]);
  const [allVisits, setAllVisits] = useState<SiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = useMemo(() => rangeFor(preset, customStart, customEnd), [preset, customStart, customEnd]);
  const includeRE = vertical !== 'hospitality';
  const includeHosp = vertical !== 'realestate';

  // Full activity history (both verticals) — needed to judge follow-ups that
  // were completed after the range ended and to see who last touched a lead.
  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    Promise.all([
      fetchActivitiesBetween(new Date(0), now),
      fetchHospitalityActivitiesBetween(new Date(0), now).catch(() => []),
      fetchAllSiteVisits(),
    ])
      .then(([re, hosp, sv]) => {
        if (cancelled) return;
        setRawActivities([
          ...re.map((a) => ({ vertical: 'Real Estate' as const, leadId: a.lead_id, type: a.type, summary: a.summary, meta: a.meta, actorId: a.actor_id, actorName: a.actor_name, created_at: a.created_at })),
          ...hosp.map((a) => ({ vertical: 'Hospitality' as const, leadId: a.hospitality_lead_id, type: a.type, summary: a.summary, meta: a.meta, actorId: a.actor_id, actorName: a.actor_name, created_at: a.created_at })),
        ]);
        setAllVisits(sv);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load report data.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Group people by user id and show their current name, so one person isn't
  // split in two when their saved name changed (e.g. email → full name).
  const allActivities = useMemo((): ReportActivity[] => {
    const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));
    return rawActivities.map(({ actorId, actorName, ...a }) => ({
      ...a,
      actor: (actorId && nameById.get(actorId)) || actorName || 'Unknown',
    }));
  }, [rawActivities, profiles]);

  const campaignName = useMemo(() => {
    const m = new Map(campaigns.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? '—' : UNASSIGNED_CAMPAIGN_LABEL);
  }, [campaigns]);

  const allLeads = useMemo((): ReportLead[] => [
    ...(includeRE ? leads.map((l): ReportLead => ({
      vertical: 'Real Estate', id: l.id, name: l.name, phone: l.phone, email: l.email, city: l.city, source: l.source,
      status: l.status, campaign: campaignName(l.campaign_id), assigned_to: l.assigned_to,
      next_followup_at: l.next_followup_at, last_activity_at: l.last_activity_at, booked_at: l.booked_at,
      cold_reason: l.cold_reason, cold_since: l.cold_since, created_at: l.created_at,
    })) : []),
    ...(includeHosp ? hospitalityLeads.map((l): ReportLead => ({
      vertical: 'Hospitality', id: l.id, name: l.name, phone: l.phone, email: l.email, city: l.city, source: l.source,
      status: l.status, campaign: '—', assigned_to: l.assigned_to,
      next_followup_at: l.next_followup_at, last_activity_at: l.last_activity_at, booked_at: l.booked_at,
      cold_reason: null, cold_since: null, created_at: l.created_at,
    })) : []),
  ], [leads, hospitalityLeads, includeRE, includeHosp, campaignName]);

  const leadKey = (v: VerticalName, id: string) => `${v}:${id}`;

  // Activities for the selected vertical, oldest first, grouped by lead.
  const verticalActivities = useMemo(
    () => allActivities.filter((a) => (a.vertical === 'Real Estate' ? includeRE : includeHosp)),
    [allActivities, includeRE, includeHosp],
  );
  const activitiesByLead = useMemo(() => {
    const m = new Map<string, ReportActivity[]>();
    for (const a of verticalActivities) {
      const k = leadKey(a.vertical, a.leadId);
      const list = m.get(k);
      if (list) list.push(a); else m.set(k, [a]);
    }
    for (const list of m.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return m;
  }, [verticalActivities]);

  const rangeActivities = useMemo(() => verticalActivities.filter((a) => inRange(a.created_at, start, end)), [verticalActivities, start, end]);
  const visits = useMemo(() => (includeRE ? allVisits.filter((v) => inRange(v.scheduled_at, start, end)) : []), [allVisits, includeRE, start, end]);
  const newLeads = useMemo(() => allLeads.filter((l) => inRange(l.created_at, start, end)), [allLeads, start, end]);

  // Who "owns" a lead for reporting: whoever it's assigned to, otherwise the
  // last person who logged something on it.
  const ownerOf = (l: ReportLead): string => {
    if (l.assigned_to) return l.assigned_to;
    const acts = activitiesByLead.get(leadKey(l.vertical, l.id));
    const lastByPerson = acts && [...acts].reverse().find((a) => a.actor !== 'Unknown' && a.type !== 'Created');
    return lastByPerson ? lastByPerson.actor : 'Unassigned';
  };

  // ---------- Overview ----------

  const pipeline = useMemo(() => {
    const byStatus = STATUSES.map((s) => ({ status: s, count: newLeads.filter((l) => l.status === s).length }));
    const contactedIds = new Set(rangeActivities.filter((a) => REACHED_OUT_TYPES.includes(a.type)).map((a) => leadKey(a.vertical, a.leadId)));
    const sales = allLeads.filter((l) => inRange(l.booked_at, start, end)).length;
    return {
      newCount: newLeads.length,
      contacted: newLeads.filter((l) => contactedIds.has(leadKey(l.vertical, l.id))).length,
      visitsScheduled: visits.length,
      visitsDone: visits.filter((v) => v.status === 'Completed').length,
      sales,
      conversion: newLeads.length > 0 ? Math.round((sales / newLeads.length) * 1000) / 10 : 0,
      byStatus,
    };
  }, [newLeads, allLeads, rangeActivities, visits, start, end]);

  // Follow-up discipline: every follow-up scheduled with a due date inside the
  // range (and already due) is checked for a call/WhatsApp/note on that lead,
  // after it was scheduled, by the end of its due day. Owned by whoever set it.
  const followUpChecks = useMemo(() => {
    const now = new Date();
    const checks: { actor: string; lead: string; vertical: VerticalName; leadId: string; due: Date; doneAt: string | null; result: 'on_time' | 'late' | 'missed' }[] = [];
    for (const a of verticalActivities) {
      if (a.type !== 'Follow-up Scheduled') continue;
      const when = typeof a.meta?.when === 'string' ? a.meta.when : null;
      if (!when) continue;
      const due = new Date(when);
      if (!inRange(when, start, end) || due.getTime() > now.getTime()) continue;
      const acts = activitiesByLead.get(leadKey(a.vertical, a.leadId)) ?? [];
      // Superseded: rescheduled again before this one fell due — don't judge it.
      const rescheduled = acts.some((x) => x.type === 'Follow-up Scheduled' && x.created_at > a.created_at && new Date(x.created_at) < startOfDay(due));
      if (rescheduled) continue;
      const done = acts.find((x) => CONTACT_TYPES.includes(x.type) && x.created_at >= a.created_at);
      const result = !done ? 'missed' : new Date(done.created_at) <= endOfDay(due) ? 'on_time' : 'late';
      checks.push({ actor: a.actor, lead: a.leadId, vertical: a.vertical, leadId: a.leadId, due, doneAt: done?.created_at ?? null, result });
    }
    return checks;
  }, [verticalActivities, activitiesByLead, start, end]);

  // Leads whose follow-up is overdue right now (before today, no contact today).
  const overdueNow = useMemo(() => {
    const today = startOfDay(new Date());
    return allLeads
      .filter((l) => isActive(l) && l.next_followup_at && new Date(l.next_followup_at) < today)
      .filter((l) => !(l.last_activity_at && new Date(l.last_activity_at) >= today))
      .map((l) => ({ lead: l, owner: ownerOf(l), daysOverdue: daysSince(l.next_followup_at!) }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLeads, activitiesByLead]);

  const productivity = useMemo(() => {
    const byActor = new Map<string, Record<string, number>>();
    const row = (actor: string) => {
      let r = byActor.get(actor);
      if (!r) { r = { total: 0 }; byActor.set(actor, r); }
      return r;
    };
    for (const a of rangeActivities) {
      if (a.type === 'Created') continue;
      const r = row(a.actor);
      r.total += 1;
      for (const col of PRODUCTIVITY_COLUMNS) if (col.types.includes(a.type)) r[col.key] = (r[col.key] ?? 0) + 1;
    }
    for (const c of followUpChecks) {
      const r = row(c.actor);
      r.fuDue = (r.fuDue ?? 0) + 1;
      r[c.result] = (r[c.result] ?? 0) + 1;
    }
    for (const o of overdueNow) row(o.owner).overdueNow = (row(o.owner).overdueNow ?? 0) + 1;
    return [...byActor.entries()]
      .map(([actor, counts]) => ({ actor, counts }))
      .sort((a, b) => b.counts.total - a.counts.total);
  }, [rangeActivities, followUpChecks, overdueNow]);

  // ---------- Never contacted ----------

  const uncontacted = useMemo(() => {
    return newLeads
      .filter((l) => l.status !== 'Junk' && !l.booked_at)
      .filter((l) => !(activitiesByLead.get(leadKey(l.vertical, l.id)) ?? []).some((a) => REACHED_OUT_TYPES.includes(a.type)))
      .map((l) => ({ lead: l, age: daysSince(l.created_at), owner: ownerOf(l) }))
      .sort((a, b) => b.age - a.age);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newLeads, activitiesByLead]);

  // ---------- Neglected ----------

  const neglected = useMemo(() => {
    return allLeads
      .filter((l) => isActive(l) && l.status !== 'Cold')
      .map((l) => ({ lead: l, idle: daysSince(l.last_activity_at ?? l.created_at), owner: ownerOf(l) }))
      .filter((x) => x.idle >= neglectDays)
      .sort((a, b) => b.idle - a.idle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLeads, activitiesByLead, neglectDays]);

  // ---------- Cold & lost ----------

  const cold = useMemo(() => {
    // Who marked each lead Cold, from its "Marked Cold" activity.
    const markedBy = new Map<string, string>();
    for (const a of verticalActivities) {
      if (a.type === 'Status Changed' && a.summary.startsWith('Marked Cold')) markedBy.set(leadKey(a.vertical, a.leadId), a.actor);
    }
    const coldLeads = allLeads.filter((l) => l.status === 'Cold' && inRange(l.cold_since, start, end));
    const tally = <K extends string>(items: K[]) => {
      const m = new Map<K, number>();
      for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const reasons = tally(coldLeads.map((l) => l.cold_reason ?? 'No reason given'));
    const reasonBySource = new Map<string, Map<string, number>>();
    for (const l of coldLeads) {
      const r = l.cold_reason ?? 'No reason given';
      const m = reasonBySource.get(r) ?? new Map<string, number>();
      m.set(l.source, (m.get(l.source) ?? 0) + 1);
      reasonBySource.set(r, m);
    }
    const lost = newLeads.filter((l) => l.status === 'Dead' || l.status === 'Junk');
    return {
      coldLeads,
      reasons,
      topSources: (reason: string) => [...(reasonBySource.get(reason)?.entries() ?? [])].sort((a, b) => b[1] - a[1]).slice(0, 3),
      byPerson: tally(coldLeads.map((l) => markedBy.get(leadKey(l.vertical, l.id)) ?? 'Unknown')),
      lostBySource: tally(lost.map((l) => `${l.source} — ${l.status}`)),
      lostCount: lost.length,
      markedBy,
    };
  }, [verticalActivities, allLeads, newLeads, start, end]);

  // ---------- CSV exports ----------

  const rangeLabel = `${formatDate(start.toISOString())} – ${formatDate(end.toISOString())}`;
  const fileTag = `${vertical}_${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`;
  const todayTag = new Date().toISOString().slice(0, 10);

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
    downloadCsv(`team-productivity_${fileTag}.csv`,
      ['Team member', ...PRODUCTIVITY_COLUMNS.map((c) => c.label), 'Answer rate', 'Total actions',
        'Follow-ups due', 'On time', 'Late', 'Missed', 'On-time %', 'Overdue now'],
      productivity.map(({ actor, counts: c }) => [
        actor, ...PRODUCTIVITY_COLUMNS.map((col) => c[col.key] ?? 0), pct(c.calls ?? 0, (c.calls ?? 0) + (c.noAnswer ?? 0)), c.total,
        c.fuDue ?? 0, c.on_time ?? 0, c.late ?? 0, c.missed ?? 0, pct(c.on_time ?? 0, c.fuDue ?? 0), c.overdueNow ?? 0,
      ]));
  }
  function exportLeads() {
    downloadCsv(`leads_${fileTag}.csv`,
      ['Vertical', 'Name', 'Phone', 'Email', 'City', 'Source', 'Status', 'Campaign', 'Assigned to', 'Next follow-up', 'Booked', 'Created'],
      newLeads.map((l) => [l.vertical, l.name, l.phone, l.email, l.city, l.source, l.status, l.campaign, l.assigned_to,
        l.next_followup_at ? formatDateTime(l.next_followup_at) : '', l.booked_at ? formatDate(l.booked_at) : '', formatDateTime(l.created_at)]));
  }
  function exportActivities() {
    const names = new Map(allLeads.map((l) => [leadKey(l.vertical, l.id), l.name]));
    downloadCsv(`activity_${fileTag}.csv`, ['When', 'Vertical', 'Team member', 'Lead', 'Type', 'Details'],
      rangeActivities.map((a) => [formatDateTime(a.created_at), a.vertical, a.actor, names.get(leadKey(a.vertical, a.leadId)) ?? '', a.type, a.summary]));
  }
  function exportVisits() {
    const names = new Map(leads.map((l) => [l.id, l.name]));
    downloadCsv(`site-visits_${fileTag}.csv`, ['Scheduled', 'Lead', 'Visit #', 'Status', 'Outcome', 'Notes'],
      visits.map((v) => [formatDateTime(v.scheduled_at), names.get(v.lead_id) ?? '', v.visit_number, v.status, v.outcome, v.notes]));
  }
  function exportOverdue() {
    downloadCsv(`overdue-followups_${vertical}_${todayTag}.csv`, ['Vertical', 'Lead', 'Phone', 'Status', 'Owner', 'Follow-up was due', 'Days overdue'],
      overdueNow.map(({ lead: l, owner, daysOverdue }) => [l.vertical, l.name, l.phone, l.status, owner, formatDateTime(l.next_followup_at), daysOverdue]));
  }
  function exportNeglected() {
    downloadCsv(`neglected-leads_${neglectDays}d_${vertical}_${todayTag}.csv`, ['Vertical', 'Lead', 'Phone', 'Status', 'Owner', 'Last activity', 'Days idle'],
      neglected.map(({ lead: l, owner, idle }) => [l.vertical, l.name, l.phone, l.status, owner, l.last_activity_at ? formatDateTime(l.last_activity_at) : 'Never', idle]));
  }
  function exportUncontacted() {
    downloadCsv(`never-contacted_${fileTag}.csv`, ['Vertical', 'Lead', 'Phone', 'Source', 'Campaign', 'Status', 'Owner', 'Created', 'Days old'],
      uncontacted.map(({ lead: l, owner, age }) => [l.vertical, l.name, l.phone, l.source, l.campaign, l.status, owner, formatDateTime(l.created_at), age]));
  }
  function exportCold() {
    downloadCsv(`cold-and-lost_${fileTag}.csv`, ['Lead', 'Source', 'Campaign', 'Cold reason', 'Marked cold by', 'Cold since'],
      cold.coldLeads.map((l) => [l.name, l.source, l.campaign, l.cold_reason ?? 'No reason given', cold.markedBy.get(leadKey(l.vertical, l.id)) ?? 'Unknown', formatDate(l.cold_since)]));
  }

  const pill = (active: boolean) => `rounded-full px-3 py-1.5 text-[12px] font-medium transition ${active ? 'brand-gradient text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;
  const spinner = <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>;

  const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutList },
    { id: 'followups', label: 'Follow-ups', icon: AlarmClock },
    { id: 'uncontacted', label: 'Never contacted', icon: PhoneOff },
    { id: 'cold', label: 'Cold & lost', icon: Snowflake },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-600">
          <FileBarChart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Reports</h1>
          <p className="text-[13px] text-gray-400">Pipeline, team performance, follow-ups and lost leads — admin only.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${tab === t.id ? 'border-cyan-600 text-cyan-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border border-black/5 bg-white p-4 card-shadow">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Vertical</span>
          {([['all', 'All'], ['realestate', 'Real Estate'], ['hospitality', 'Hospitality']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setVertical(v)} className={pill(vertical === v)}>{label}</button>
          ))}
        </div>
        {tab !== 'followups' && (
          <>
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
          </>
        )}
        {tab === 'followups' && <p className="text-[12px] text-gray-400">Shows where things stand right now — no date range needed.</p>}
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {tab === 'overview' && (
        <>
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

          <Card icon={Users} title="Team productivity" onDownload={exportProductivity}>
            {loading ? spinner : productivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No team activity in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="py-2 pr-3 font-semibold" rowSpan={2}>Team member</th>
                      <th className="px-2 pt-2 text-center font-semibold text-gray-500" colSpan={PRODUCTIVITY_COLUMNS.length + 2}>Activity</th>
                      <th className="border-l border-gray-100 px-2 pt-2 text-center font-semibold text-gray-500" colSpan={6}>Follow-up discipline</th>
                    </tr>
                    <tr>
                      {PRODUCTIVITY_COLUMNS.map((c) => <th key={c.key} className="px-2 py-2 text-right font-semibold">{c.label}</th>)}
                      <th className="px-2 py-2 text-right font-semibold" title="Calls answered ÷ (answered + no answer)">Answer rate</th>
                      <th className="px-2 py-2 text-right font-semibold">Total</th>
                      <th className="border-l border-gray-100 px-2 py-2 text-right font-semibold" title="Follow-ups they scheduled that fell due in this period">Due</th>
                      <th className="px-2 py-2 text-right font-semibold">On time</th>
                      <th className="px-2 py-2 text-right font-semibold">Late</th>
                      <th className="px-2 py-2 text-right font-semibold">Missed</th>
                      <th className="px-2 py-2 text-right font-semibold">On-time %</th>
                      <th className="px-2 py-2 text-right font-semibold" title="Their leads overdue right now">Overdue now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {productivity.map(({ actor, counts: c }) => (
                      <tr key={actor}>
                        <td className="py-2.5 pr-3 font-semibold text-gray-900">{actor}</td>
                        {PRODUCTIVITY_COLUMNS.map((col) => <td key={col.key} className="px-2 py-2.5 text-right text-gray-600">{c[col.key] ?? 0}</td>)}
                        <td className="px-2 py-2.5 text-right font-semibold text-gray-800">{pct(c.calls ?? 0, (c.calls ?? 0) + (c.noAnswer ?? 0))}</td>
                        <td className="px-2 py-2.5 text-right font-bold text-gray-900">{c.total}</td>
                        <td className="border-l border-gray-100 px-2 py-2.5 text-right text-gray-600">{c.fuDue ?? 0}</td>
                        <td className="px-2 py-2.5 text-right text-emerald-600">{c.on_time ?? 0}</td>
                        <td className="px-2 py-2.5 text-right text-amber-600">{c.late ?? 0}</td>
                        <td className="px-2 py-2.5 text-right text-red-600">{c.missed ?? 0}</td>
                        <td className="px-2 py-2.5 text-right font-semibold text-gray-800">{pct(c.on_time ?? 0, c.fuDue ?? 0)}</td>
                        <td className={`px-2 py-2.5 text-right font-semibold ${(c.overdueNow ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{c.overdueNow ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <ul className="mt-3 space-y-1 text-[12px] text-gray-400">
              <li><b className="font-semibold text-gray-500">Answer rate</b> — “Called” ÷ (“Called” + “No answer”). Calls logged only as a note aren’t counted.</li>
              <li><b className="font-semibold text-gray-500">Follow-up discipline</b> — follow-ups each person scheduled that fell due in this period. On time = a call, WhatsApp or note on that lead by the end of the due day; late = after; missed = nothing yet. Follow-ups rescheduled before they fell due are skipped.</li>
              <li><b className="font-semibold text-gray-500">Overdue now</b> — their leads overdue today (assigned to them, or last handled by them if unassigned).</li>
            </ul>
          </Card>

          <Card icon={Download} title="Downloads">
            <div className="grid gap-2 sm:grid-cols-3">
              <DownloadButton label="Leads" detail={`${newLeads.length} created in range`} onClick={exportLeads} />
              <DownloadButton label="Activity log" detail={loading ? 'Loading…' : `${rangeActivities.length} actions`} onClick={exportActivities} disabled={loading} />
              <DownloadButton label="Site visits" detail={includeRE ? `${visits.length} in range` : 'Real Estate only'} onClick={exportVisits} disabled={loading || !includeRE} />
            </div>
          </Card>

          <button onClick={onOpenCampaigns} className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white p-5 text-left card-shadow transition hover:bg-gray-50">
            <span className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-gray-900">
              <Megaphone className="h-4 w-4 text-gray-400" /> Campaign performance
            </span>
            <span className="text-[13px] font-medium text-cyan-700">Open Campaigns →</span>
          </button>
        </>
      )}

      {tab === 'followups' && (
        <>
          <Card icon={AlarmClock} title={`Overdue follow-ups (${overdueNow.length})`} onDownload={exportOverdue}>
            {loading ? spinner : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {OVERDUE_BUCKETS.map((b) => (
                    <Stat key={b.label} label={`Overdue ${b.label}`} value={overdueNow.filter((o) => o.daysOverdue >= b.min && o.daysOverdue <= b.max).length} />
                  ))}
                </div>
                <PersonChips counts={tallyBy(overdueNow.map((o) => o.owner))} />
                <LeadTable
                  rows={overdueNow.map((o) => ({ lead: o.lead, owner: o.owner, cells: [formatDate(o.lead.next_followup_at), `${o.daysOverdue}d`] }))}
                  headers={['Was due', 'Overdue']}
                  onOpenLead={onOpenLead}
                  empty="Nothing overdue — every follow-up is on track."
                />
              </>
            )}
          </Card>

          <Card icon={AlarmClock} title={`Neglected leads (${neglected.length})`} onDownload={exportNeglected}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-gray-500">No activity for</span>
              {[7, 14, 30].map((d) => <button key={d} onClick={() => setNeglectDays(d)} className={pill(neglectDays === d)}>{d}+ days</button>)}
            </div>
            {loading ? spinner : (
              <>
                <PersonChips counts={tallyBy(neglected.map((n) => n.owner))} />
                <LeadTable
                  rows={neglected.map((n) => ({ lead: n.lead, owner: n.owner, cells: [n.lead.last_activity_at ? formatDate(n.lead.last_activity_at) : 'Never', `${n.idle}d`] }))}
                  headers={['Last activity', 'Idle']}
                  onOpenLead={onOpenLead}
                  empty={`No active lead has gone ${neglectDays}+ days without activity.`}
                />
              </>
            )}
            <p className="mt-3 text-[12px] text-gray-400">Active leads (not Cold, Dead, Junk or sold) with nothing logged for the chosen number of days.</p>
          </Card>
        </>
      )}

      {tab === 'uncontacted' && (
        <Card icon={PhoneOff} title={`New leads never contacted (${uncontacted.length})`} onDownload={exportUncontacted}>
          {loading ? spinner : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="New leads in range" value={newLeads.length} />
                <Stat label="Never contacted" value={uncontacted.length} />
                <Stat label="Share uncontacted" value={pct(uncontacted.length, newLeads.length)} />
                <Stat label="Waiting 3+ days" value={uncontacted.filter((u) => u.age >= 3).length} />
              </div>
              <h3 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-gray-400">By source</h3>
              <div className="flex flex-wrap gap-2">
                {tallyBy(uncontacted.map((u) => u.lead.source)).map(([source, n]) => {
                  const total = newLeads.filter((l) => l.source === source).length;
                  return (
                    <span key={source} className="rounded-full bg-gray-100 px-3 py-1 text-[12px] text-gray-600">
                      {source} <span className="font-bold text-gray-900">{n}</span><span className="text-gray-400"> of {total}</span>
                    </span>
                  );
                })}
              </div>
              <LeadTable
                rows={uncontacted.map((u) => ({ lead: u.lead, owner: u.owner, cells: [u.lead.source, formatDate(u.lead.created_at), `${u.age}d`] }))}
                headers={['Source', 'Created', 'Waiting']}
                onOpenLead={onOpenLead}
                empty="Every new lead in this period has been called or messaged."
              />
            </>
          )}
          <p className="mt-3 text-[12px] text-gray-400">Leads created in the range with no call, no-answer or WhatsApp logged yet (Junk and sold leads excluded).</p>
        </Card>
      )}

      {tab === 'cold' && (
        <>
          <Card icon={Snowflake} title={`Leads gone cold (${cold.coldLeads.length})`} onDownload={exportCold}>
            {!includeRE ? (
              <p className="py-6 text-center text-sm text-gray-400">Cold reasons are only recorded for Real Estate leads.</p>
            ) : loading ? spinner : cold.coldLeads.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No leads were marked Cold in this period.</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Reasons</h3>
                  <ul className="space-y-2">
                    {cold.reasons.map(([reason, n]) => (
                      <li key={reason}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-800">{reason}</span>
                          <span className="font-semibold text-gray-900">{n} <span className="font-normal text-gray-400">({pct(n, cold.coldLeads.length)})</span></span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-sky-400" style={{ width: `${(n / cold.coldLeads.length) * 100}%` }} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          Top sources: {cold.topSources(reason).map(([s, c]) => `${s} (${c})`).join(', ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Marked cold by</h3>
                  <ul className="divide-y divide-gray-100">
                    {cold.byPerson.map(([person, n]) => (
                      <li key={person} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-gray-800">{person}</span>
                        <span className="font-semibold text-gray-900">{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <p className="mt-3 text-[12px] text-gray-400">Leads still Cold that were marked Cold during the range.</p>
          </Card>

          <Card icon={Snowflake} title={`Lost leads — Dead or Junk (${cold.lostCount})`}>
            {cold.lostCount === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No new leads in this period ended up Dead or Junk.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {cold.lostBySource.map(([label, n]) => (
                  <li key={label} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-gray-800">{label}</span>
                    <span className="font-semibold text-gray-900">{n}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[12px] text-gray-400">New leads from the range now marked Dead or Junk, by source. No reason is recorded when a lead is marked Dead.</p>
          </Card>
        </>
      )}
    </div>
  );
}

function tallyBy(items: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function PersonChips({ counts }: { counts: [string, number][] }) {
  if (counts.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {counts.map(([person, n]) => (
        <span key={person} className="rounded-full bg-red-50 px-3 py-1 text-[12px] text-red-700">
          {person} <span className="font-bold">{n}</span>
        </span>
      ))}
    </div>
  );
}

function LeadTable({ rows, headers, onOpenLead, empty }: {
  rows: { lead: ReportLead; owner: string; cells: string[] }[];
  headers: string[];
  onOpenLead: (vertical: VerticalName, id: string) => void;
  empty: string;
}) {
  const [showAll, setShowAll] = useState(false);
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-gray-400">{empty}</p>;
  const visible = showAll ? rows : rows.slice(0, 25);
  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-gray-400">
            <tr>
              <th className="py-2 pr-3 font-semibold">Lead</th>
              <th className="px-2 py-2 font-semibold">Status</th>
              <th className="px-2 py-2 font-semibold">Owner</th>
              {headers.map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map(({ lead, owner, cells }) => (
              <tr key={`${lead.vertical}:${lead.id}`}>
                <td className="py-2 pr-3">
                  <button onClick={() => onOpenLead(lead.vertical, lead.id)} className="text-left font-semibold text-gray-900 hover:text-cyan-700">{lead.name}</button>
                  {lead.vertical === 'Hospitality' && <span className="ml-1.5 text-[11px] text-rose-500">Hospitality</span>}
                </td>
                <td className="px-2 py-2 text-gray-600">{lead.status}</td>
                <td className="px-2 py-2 text-gray-600">{owner}</td>
                {cells.map((c, i) => <td key={i} className="px-2 py-2 text-gray-600">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 25 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-[13px] font-medium text-cyan-700">
          {showAll ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

function Card({ icon: Icon, title, onDownload, children }: { icon: typeof Users; title: string; onDownload?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-gray-900">
          <Icon className="h-4 w-4 text-gray-400" /> {title}
        </h2>
        {onDownload && (
          <button onClick={onDownload} className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/5 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 card-shadow transition hover:text-gray-900">
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
