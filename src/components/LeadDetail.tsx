import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Phone, MessageCircle, MapPin, Home, XCircle,
  CalendarClock, Flame, Trash2, Check, ChevronRight, Clock, Plus, X, Pencil,
  User, Award, CheckCircle2,
} from 'lucide-react';
import type { Lead, Activity, ActivityType, Campaign, SiteVisit, InterestLevel, TourOutcome, ColdReason, LeadStatus } from '@/lib/supabase';
import {
  fetchLead, fetchActivities, recordAction, scheduleFollowUp,
  completeSiteVisit, completeSiteVisitById, updateLead, deleteLead, fetchSiteVisits, createSiteVisit,
  isFollowUpRequired,
  toLocalInputValue,
  relativeDay, formatDate, formatTime, formatDateTime, daysFromNow, isToday, isOverdue,
  markLeadCold, fetchReactivationAttempts,
} from '@/lib/crm';
import { statusStyles } from '@/lib/styles';
import { STATUSES } from '@/lib/crm';
import GuidedFlow from './GuidedFlow';
import FollowUpSheet from './FollowUpSheet';
import EditLeadModal from './EditLeadModal';
import ColdReasonModal from './ColdReasonModal';
import type { ReactivationAttempt } from '@/lib/supabase';

interface Props {
  id: string;
  leads: Lead[];
  campaigns: Campaign[];
  onBack: () => void;
  onChanged: () => void;
}

type Sheet = 'followup' | 'guided' | 'callResult' | null;
type Tab = 'timeline' | 'followups' | 'sitevisits' | 'notes' | 'reactivation';

const tabConfig: { id: Tab; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'sitevisits', label: 'Site Visits' },
  { id: 'notes', label: 'Notes' },
  { id: 'reactivation', label: 'Reactivation History' },
];

export default function LeadDetail({ id, leads, campaigns, onBack, onChanged }: Props) {
  const [lead, setLead] = useState<Lead | null>(leads.find((l) => l.id === id) ?? null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [tab, setTab] = useState<Tab>('timeline');
  const [editing, setEditing] = useState(false);
  const [coldFor, setColdFor] = useState<Lead | null>(null);
  const [reactivationAttempts, setReactivationAttempts] = useState<ReactivationAttempt[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [l, acts, svs, ras] = await Promise.all([fetchLead(id), fetchActivities(id), fetchSiteVisits(id), fetchReactivationAttempts(id)]);
      setLead(l);
      setActivities(acts);
      setSiteVisits(svs);
      setReactivationAttempts(ras);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function doAction(type: ActivityType, summary: string, patch: Partial<Lead> = {}) {
    if (!lead || busy) return;
    setBusy(true);
    try {
      const { lead: updated } = await recordAction(lead, type, summary, patch);
      setLead(updated);
      const acts = await fetchActivities(id);
      setActivities(acts);
      onChanged();
      setSheet('followup');
    } finally {
      setBusy(false);
    }
  }

  async function handleGuidedResult(result: { type: ActivityType; summary: string; patch: Partial<Lead>; followUpInDays?: number; siteVisitAt?: string; notes?: string }) {
    if (!lead) return;
    setBusy(true);
    try {
      let patch = { ...result.patch };
      let when = result.followUpInDays ? daysFromNow(result.followUpInDays) : lead.next_followup_at;
      if (result.siteVisitAt) {
        await createSiteVisit({
          lead_id: lead.id,
          visit_number: 1,
          scheduled_at: result.siteVisitAt,
          property: null, family_members: null, customer_feedback: null,
          interest_level: null, outcome: null, notes: null,
          next_followup_at: result.siteVisitAt, status: 'Scheduled',
        });
        when = result.siteVisitAt;
        patch = { ...patch, site_visit_at: result.siteVisitAt, status: 'Warm' as const };
      }
      const { lead: updated } = await recordAction(lead, result.type, result.summary, patch);
      if (result.notes && result.notes.trim()) {
        await recordAction(updated, 'Note Added', result.notes.trim());
      }
      const finalLead = await updateLead(updated.id, { next_followup_at: when });
      setLead(finalLead);
      const acts = await fetchActivities(id);
      setActivities(acts);
      onChanged();
      setSheet(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleFollowUp(when: string, summary: string) {
    if (!lead) return;
    setBusy(true);
    try {
      const { lead: updated } = await scheduleFollowUp(lead, when, summary);
      setLead(updated);
      const acts = await fetchActivities(id);
      setActivities(acts);
      onChanged();
      setSheet(null);
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!lead || !note.trim()) return;
    setBusy(true);
    setNoteError(null);
    try {
      await recordAction(lead, 'Note Added', note.trim());
      setNote('');
      setShowNoteInput(false);
      const acts = await fetchActivities(id);
      setActivities(acts);
      onChanged();
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Could not save this note. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!lead) return;
    if (!confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
    await deleteLead(lead.id);
    onChanged();
    onBack();
  }

  async function handleCompleteSiteVisit() {
    if (!lead) return;
    // Find the most recent scheduled site visit and mark it completed.
    const scheduled = siteVisits.filter((v) => v.status === 'Scheduled').sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    if (scheduled.length > 0) {
      const visit = scheduled[0];
      setBusy(true);
      try {
        await completeSiteVisitById(visit.id, lead.id);
        await load();
        onChanged();
        setSheet('followup');
      } finally {
        setBusy(false);
      }
    } else {
      // No scheduled visit — use the legacy completeSiteVisit function.
      setBusy(true);
      try {
        const { lead: u } = await completeSiteVisit(lead);
        setLead(u);
        setActivities(await fetchActivities(id));
        onChanged();
        setSheet('followup');
      } finally {
        setBusy(false);
      }
    }
  }

  async function handleCallResult(status: LeadStatus) {
    if (!lead) return;
    setSheet(null);
    if (status === 'Cold') {
      setColdFor(lead);
      return;
    }
    await doAction('Called', `Called — status set to ${status}.`, { status });
  }

  async function confirmCold(reason: ColdReason, nextReactivationAt: string) {
    if (!coldFor) return;
    await markLeadCold(coldFor, reason, nextReactivationAt);
    setColdFor(null);
    await load();
    onChanged();
  }

  if (loading && !lead) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="py-24 text-center">
        <p className="text-gray-500">Lead not found.</p>
        <button onClick={onBack} className="mt-3 text-sm font-semibold text-emerald-600">Back to leads</button>
      </div>
    );
  }

  const ss = statusStyles(lead.status);
  const overdue = isOverdue(lead.next_followup_at) && !isToday(lead.next_followup_at);
  const followUpRequired = isFollowUpRequired(lead);

  const followUpActivities = activities.filter((a) => a.type === 'Follow-up Scheduled');
  const noteActivities = activities.filter((a) => a.type === 'Note Added' || a.type === 'Called' || a.type === 'No Answer' || a.type === 'WhatsApp Sent' || a.type === 'Site Visit Scheduled');

  const quickActions: { icon: typeof Phone; label: string; color: string; action: () => void }[] = [
    { icon: Phone, label: 'Called', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200', action: () => setSheet('callResult') },
    { icon: MessageCircle, label: 'WhatsApp Sent', color: 'bg-green-50 text-green-700 ring-green-200', action: () => doAction('WhatsApp Sent', 'Sent WhatsApp message') },
    { icon: MapPin, label: 'Site Visit Scheduled', color: 'bg-violet-50 text-violet-700 ring-violet-200', action: () => setSiteVisitOpen(true) },
    { icon: Home, label: 'Site Visit Completed', color: 'bg-teal-50 text-teal-700 ring-teal-200', action: () => handleCompleteSiteVisit() },
    { icon: Award, label: 'Sale Completed', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200', action: () => doAction('Sale Completed', 'Sale completed!', { booked_at: new Date().toISOString() }) },
    { icon: XCircle, label: 'Not Interested', color: 'bg-gray-100 text-gray-600 ring-gray-200', action: () => doAction('Not Interested', 'Marked not interested', { status: 'Dead' }) },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> All Leads
        </button>
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-3.5 py-1.5 text-sm font-semibold text-gray-600 card-shadow transition hover:text-emerald-600"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      </div>

      {/* Lead header */}
      <div className="overflow-hidden rounded-3xl border border-black/5 bg-white card-shadow">
        <div className="brand-gradient px-5 py-5 text-white sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">{lead.name}</h1>
              <a href={`tel:${lead.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-emerald-100/90 hover:text-white">
                <Phone className="h-3.5 w-3.5" /> {lead.phone}
              </a>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={`rounded-full ${ss.bg} ${ss.text} px-2.5 py-1 text-[12px] font-semibold ring-1 ${ss.ring}`}>
                {lead.status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-4">
          <Meta label="Source" value={lead.source} />
          <Meta label="City" value={lead.city || '—'} />
          <Meta label="Email" value={lead.email || '—'} />
          <Meta label="Created" value={formatDate(lead.created_at)} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3.5 sm:px-7">
          {followUpRequired ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <CalendarClock className={`h-4 w-4 ${overdue ? 'text-red-500' : 'text-emerald-600'}`} />
                <span className="text-gray-500">Next follow-up:</span>
                <span className={`font-semibold ${overdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {overdue ? relativeDay(lead.next_followup_at) : isToday(lead.next_followup_at) ? `Today · ${formatTime(lead.next_followup_at)}` : formatDateTime(lead.next_followup_at)}
                </span>
              </div>
              <button
                onClick={() => setSheet('followup')}
                className="rounded-full bg-emerald-50 px-3.5 py-1.5 text-[13px] font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
              >
                Reschedule
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <CalendarClock className="h-4 w-4" />
              <span>No follow-up required — lead is {lead.status}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6">
        <h2 className="mb-3 font-display text-base font-bold tracking-tight text-gray-900">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={a.action}
              disabled={busy}
              className={`flex flex-col items-center gap-2 rounded-2xl bg-white px-3 py-4 text-center ring-1 transition hover:shadow-md disabled:opacity-50 ${a.color}`}
            >
              <a.icon className="h-6 w-6" />
              <span className="text-[13px] font-semibold">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Guided flow hint */}
      <button
        onClick={() => setSheet('guided')}
        className="mt-3 flex w-full items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-left transition hover:bg-emerald-50"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <Flame className="h-4 w-4" /> Start guided call flow
        </span>
        <ChevronRight className="h-4 w-4 text-emerald-500" />
      </button>

      {/* Tabs */}
      <div className="mt-8">
        <div className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-gray-100">
          {tabConfig.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${tab === t.id ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {t.label}
              {tab === t.id && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full brand-gradient" />}
            </button>
          ))}
        </div>

        {/* Timeline tab */}
        {tab === 'timeline' && (
          activities.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">No activity yet.</p>
          ) : (
            <Timeline activities={activities} />
          )
        )}

        {/* Follow-ups tab */}
        {tab === 'followups' && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-gray-500">Follow-up history</p>
              {followUpRequired && (
                <button onClick={() => setSheet('followup')} className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-600 hover:text-emerald-700">
                  <Plus className="h-3.5 w-3.5" /> Schedule
                </button>
              )}
            </div>
            {!followUpRequired && followUpActivities.length === 0 ? (
              <EmptyState label={`No follow-ups — lead is ${lead.status}.`} />
            ) : followUpActivities.length === 0 ? (
              <EmptyState label="No follow-ups scheduled yet." />
            ) : (
              <FollowUpTimeline activities={followUpActivities} currentFollowUp={lead.next_followup_at} />
            )}
          </div>
        )}

        {/* Site visits tab */}
        {tab === 'sitevisits' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">Site visit history</p>
              <button onClick={() => setSiteVisitOpen(true)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-violet-600 hover:text-violet-700">
                <Plus className="h-3.5 w-3.5" /> Schedule Visit
              </button>
            </div>
            {siteVisits.length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-3">
                <SummaryCard label="Total Site Visits" value={String(siteVisits.length)} />
                <SummaryCard label="Latest Visit" value={formatDate(siteVisits[siteVisits.length - 1].scheduled_at)} />
                <SummaryCard label="First Visit" value={formatDate(siteVisits[0].scheduled_at)} />
              </div>
            )}
            {siteVisits.length === 0 ? (
              <EmptyState label="No site visits recorded yet. Schedule the first visit to start tracking the customer journey." />
            ) : (
              <div className="space-y-3">
                {siteVisits.map((sv) => (
                  <SiteVisitCard key={sv.id} visit={sv} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes tab */}
        {tab === 'notes' && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-gray-500">Notes</p>
              <button onClick={() => { setShowNoteInput((v) => !v); setNoteError(null); }} className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-600 hover:text-emerald-700">
                <Plus className="h-3.5 w-3.5" /> Add note
              </button>
            </div>
            {showNoteInput && (
              <div className="mb-4 animate-fade-up">
                <div className="flex gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note…"
                    autoFocus
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300"
                  />
                  <button onClick={addNote} disabled={busy || !note.trim()} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => { setShowNoteInput(false); setNote(''); setNoteError(null); }} className="rounded-xl bg-gray-100 px-3 py-2.5 text-gray-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {noteError && <p className="mt-1.5 text-[12px] font-medium text-red-600">{noteError}</p>}
              </div>
            )}
            {noteActivities.length === 0 ? (
              <EmptyState label="No notes yet." />
            ) : (
              <div className="space-y-2">
                {noteActivities.map((a) => (
                  <div key={a.id} className="rounded-2xl border border-black/5 bg-white px-4 py-3 card-shadow animate-fade-up">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">{a.type}</span>
                      <span className="text-[11px] text-gray-400">{formatDate(a.created_at)} · {formatTime(a.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{a.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'reactivation' && (
          <ReactivationHistoryTab lead={lead} attempts={reactivationAttempts} activities={activities} siteVisits={siteVisits} />
        )}
      </div>

      {/* Danger zone */}
      <div className="mt-8 border-t border-gray-100 pt-4">
        <button onClick={handleDelete} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-400 transition hover:text-red-600">
          <Trash2 className="h-4 w-4" /> Delete lead
        </button>
      </div>

      {/* Sheets */}
      {sheet === 'followup' && (
        <FollowUpSheet
          onClose={() => setSheet(null)}
          onPick={handleFollowUp}
          current={lead.next_followup_at}
        />
      )}
      {sheet === 'callResult' && (
        <CallResultSheet
          leadName={lead.name}
          onClose={() => setSheet(null)}
          onResult={handleCallResult}
        />
      )}
      {sheet === 'guided' && (
        <GuidedFlow
          onClose={() => setSheet(null)}
          onComplete={handleGuidedResult}
        />
      )}
      {editing && (
        <EditLeadModal
          lead={lead}
          campaigns={campaigns}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { setEditing(false); setLead(updated); if (updated.status === 'Cold' && lead.status !== 'Cold' && !updated.cold_reason) { setColdFor(updated); } else { onChanged(); } }}
        />
      )}
      {coldFor && (
        <ColdReasonModal lead={coldFor} onClose={() => setColdFor(null)} onConfirm={confirmCold} />
      )}
      {siteVisitOpen && lead && (
        <SiteVisitModal
          leadId={lead.id}
          visitNumber={siteVisits.length + 1}
          onClose={() => setSiteVisitOpen(false)}
          onCreated={async () => { setSiteVisitOpen(false); await load(); onChanged(); }}
        />
      )}
    </div>
  );
}

function FollowUpTimeline({ activities, currentFollowUp }: { activities: Activity[]; currentFollowUp: string | null }) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
      <div className="space-y-4">
        {activities.map((a, i) => {
          const when = (a.meta?.when as string) ?? '';
          const isLatest = i === 0;
          const isActive = isLatest && when === currentFollowUp;
          const previous = a.meta?.previous as string | undefined;
          return (
            <div key={a.id} className="relative animate-fade-up">
              <span className={`absolute -left-[22px] top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full ring-2 ${isActive ? 'bg-emerald-50 ring-emerald-400' : 'bg-white ring-gray-300'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              </span>
              <div className="rounded-2xl border border-black/5 bg-white px-4 py-3 card-shadow">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-gray-900">{isActive ? 'Current follow-up' : 'Follow-up'}</span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock className="h-3 w-3" />
                    {formatDate(a.created_at)} · {formatTime(a.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-gray-500">{a.summary}</p>
                {previous && !isActive && (
                  <p className="mt-1 text-[11px] text-gray-400">Was scheduled for {formatDate(previous)} — superseded</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ activities }: { activities: Activity[] }) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
      <div className="space-y-4">
        {activities.map((a) => (
          <div key={a.id} className="relative animate-fade-up">
            <span className="absolute -left-[22px] top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-white ring-2 ring-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <div className="rounded-2xl border border-black/5 bg-white px-4 py-3 card-shadow">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-gray-900">{a.type}</span>
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Clock className="h-3 w-3" />
                  {formatDate(a.created_at)} · {formatTime(a.created_at)}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-gray-500">{a.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">{label}</p>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3 sm:px-5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 truncate text-[14px] font-medium text-gray-800">{value}</div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-3.5 card-shadow">
      <div className="font-display text-xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-[11px] font-medium text-gray-400">{label}</div>
    </div>
  );
}

function SiteVisitCard({ visit }: { visit: SiteVisit }) {
  const statusColor =
    visit.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
    visit.status === 'Cancelled' ? 'bg-gray-100 text-gray-500 ring-gray-200' :
    visit.status === 'No Show' ? 'bg-rose-50 text-rose-700 ring-rose-200' :
    'bg-violet-50 text-violet-700 ring-violet-200';
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 card-shadow animate-fade-up">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-50 text-sm font-bold text-violet-700">{visit.visit_number}</span>
          <div>
            <h4 className="text-sm font-bold text-gray-900">Visit {visit.visit_number}</h4>
            <p className="text-[11px] text-gray-400">{formatDateTime(visit.scheduled_at)}</p>
          </div>
        </div>
        <span className={`rounded-full ${statusColor} px-2.5 py-1 text-[11px] font-semibold ring-1`}>{visit.status}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        {visit.property && <div><span className="text-gray-400">Property:</span> <span className="font-medium text-gray-700">{visit.property}</span></div>}
        {visit.family_members && <div><span className="text-gray-400">Family:</span> <span className="font-medium text-gray-700">{visit.family_members}</span></div>}
        {visit.interest_level && <div><span className="text-gray-400">Interest:</span> <span className="font-medium text-gray-700">{visit.interest_level}</span></div>}
        {visit.outcome && <div><span className="text-gray-400">Outcome:</span> <span className="font-medium text-gray-700">{visit.outcome}</span></div>}
        {visit.next_followup_at && <div><span className="text-gray-400">Next follow-up:</span> <span className="font-medium text-gray-700">{formatDate(visit.next_followup_at)}</span></div>}
      </div>
      {visit.customer_feedback && <p className="mt-2 rounded-lg bg-amber-50/60 px-3 py-2 text-[12px] text-gray-600">{visit.customer_feedback}</p>}
      {visit.notes && <p className="mt-2 text-[12px] text-gray-500">{visit.notes}</p>}
    </div>
  );
}

function SiteVisitModal({ leadId, visitNumber, onClose, onCreated }: {
  leadId: string;
  visitNumber: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [date, setDate] = useState(() => toLocalInputValue(new Date(Date.now() + 86400000).toISOString()).slice(0, 10));
  const [time, setTime] = useState('11:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      await createSiteVisit({
        lead_id: leadId,
        visit_number: visitNumber,
        scheduled_at: scheduledAt,
        property: null,
        family_members: null,
        customer_feedback: null,
        interest_level: null,
        outcome: null,
        notes: notes.trim() || null,
        next_followup_at: scheduledAt,
        status: 'Scheduled',
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not schedule visit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:animate-scale-in sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">Schedule Visit {visitNumber}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any special requests…" className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300" />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex gap-3 border-t border-gray-100 bg-white px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-full bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-200">Cancel</button>
          <button onClick={save} disabled={saving} className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full brand-gradient py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60">
            {saving ? 'Scheduling…' : `Schedule Visit ${visitNumber}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CallResultSheet({ leadName, onClose, onResult }: { leadName: string; onClose: () => void; onResult: (status: LeadStatus) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md animate-fade-up rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-gray-900">Log Call — {leadName}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-sm text-gray-500">Select the new status for this lead:</p>
        <div className="grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => onResult(s)}
              className="rounded-xl px-3 py-3 text-[13px] font-semibold transition bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReactivationHistoryTab({ lead, attempts, activities, siteVisits }: {
  lead: Lead;
  attempts: ReactivationAttempt[];
  activities: Activity[];
  siteVisits: SiteVisit[];
}) {
  const coldSince = lead.cold_since ? formatDate(lead.cold_since) : '—';
  const daysInCold = lead.cold_since ? Math.max(0, Math.round((Date.now() - new Date(lead.cold_since).getTime()) / 86400000)) : 0;
  const lastContact = lead.last_contacted_at ? formatDateTime(lead.last_contacted_at) : '—';

  const timeline = useMemo(() => {
    type Item = { id: string; date: string; title: string; sub: string; tone: 'cold' | 'attempt' | 'visit' | 'activity' };
    const items: Item[] = [];
    if (lead.cold_since) items.push({ id: 'cold', date: lead.cold_since, title: 'Marked Cold', sub: lead.cold_reason ?? 'Reason not recorded', tone: 'cold' });
    attempts.forEach((a) => items.push({ id: a.id, date: a.contacted_at, title: `Reactivation attempt — ${a.outcome}`, sub: a.notes ?? a.reason, tone: a.reactivated ? 'attempt' : 'activity' }));
    siteVisits.forEach((v) => items.push({ id: v.id, date: v.scheduled_at, title: `Site Visit ${v.visit_number}`, sub: v.outcome ?? v.status, tone: 'visit' }));
    activities.filter((a) => a.type === 'Called' || a.type === 'WhatsApp Sent').forEach((a) => items.push({ id: a.id, date: a.created_at, title: a.type, sub: a.summary, tone: 'activity' }));
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [lead, attempts, activities, siteVisits]);

  const toneStyles: Record<string, string> = {
    cold: 'bg-sky-50 text-sky-700 ring-sky-200',
    attempt: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    visit: 'bg-violet-50 text-violet-700 ring-violet-200',
    activity: 'bg-gray-50 text-gray-600 ring-gray-200',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Cold Since" value={coldSince} />
        <SummaryCard label="Days in Cold" value={String(daysInCold)} />
        <SummaryCard label="Reason" value={lead.cold_reason ?? '—'} />
        <SummaryCard label="Last Contact" value={lastContact} />
      </div>

      <div>
        <h3 className="mb-3 font-display text-base font-bold tracking-tight text-gray-900">Reactivation Timeline</h3>
        {timeline.length === 0 ? (
          <EmptyState label="No reactivation history yet." />
        ) : (
          <div className="space-y-2">
            {timeline.map((it) => (
              <div key={it.id} className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white p-3.5 card-shadow">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1 ${toneStyles[it.tone]}`}>
                  {it.tone === 'cold' ? 'C' : it.tone === 'attempt' ? 'R' : it.tone === 'visit' ? 'V' : '•'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{it.title}</p>
                    <span className="shrink-0 text-[11px] text-gray-400">{formatDateTime(it.date)}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-gray-500">{it.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
