import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, Phone, MessageCircle, MapPin, CalendarClock,
  Trash2, Check, Clock, Plus, X, Pencil, User, CheckCircle2,
} from 'lucide-react';
import type { LeadStatus, Profile } from '@/lib/supabase';
import {
  fetchHospitalityLead, fetchHospitalityActivities, recordHospitalityAction, scheduleHospitalityFollowUp,
  updateHospitalityLead, deleteHospitalityLead, isHospitalityFollowUpRequired,
  HOSPITALITY_STATUSES, type HospitalityLead, type HospitalityActivity,
} from '@/lib/hospitality';
import { relativeDay, formatDate, formatTime, isToday, isOverdue } from '@/lib/crm';
import { statusStyles } from '@/lib/styles';
import FollowUpSheet from './FollowUpSheet';
import EditHospitalityLeadModal from './EditHospitalityLeadModal';

interface Props {
  id: string;
  leads: HospitalityLead[];
  profiles: Profile[];
  onBack: () => void;
  onChanged: () => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function HospitalityLeadDetail({ id, leads, profiles, onBack, onChanged }: Props) {
  const [lead, setLead] = useState<HospitalityLead | null>(leads.find((l) => l.id === id) ?? null);
  const [activities, setActivities] = useState<HospitalityActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!UUID_RE.test(id)) {
      setLead(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [l, acts] = await Promise.all([fetchHospitalityLead(id), fetchHospitalityActivities(id)]);
      setLead(l);
      setActivities(acts);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not load this lead.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function doAction(type: HospitalityActivity['type'], summary: string, patch: Partial<HospitalityLead> = {}) {
    if (!lead || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const { lead: updated } = await recordHospitalityAction(lead, type, summary, patch);
      setLead(updated);
      setActivities(await fetchHospitalityActivities(id));
      onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save this action. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!note.trim() || !lead) return;
    await doAction('Note Added', note.trim());
    setNote('');
    setShowNoteInput(false);
  }

  async function changeStatus(status: LeadStatus) {
    if (!lead) return;
    const patch: Partial<HospitalityLead> = { status };
    if (status === 'Dead' || status === 'Junk') patch.next_followup_at = null;
    await doAction('Status Changed', `Marked ${status}`, patch);
  }

  async function markBooked() {
    if (!lead) return;
    await doAction('Booking', 'Booking confirmed', { status: 'Hot', booked_at: new Date().toISOString().slice(0, 10), next_followup_at: null });
  }

  async function deleteThisLead() {
    if (!lead) return;
    if (!confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteHospitalityLead(lead.id);
      onChanged();
      onBack();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete this lead.');
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="py-24 text-center">
        <p className="font-display text-lg font-bold text-gray-900">Lead not found</p>
        <button onClick={onBack} className="mt-4 text-sm font-semibold text-rose-600 hover:text-rose-700">← Back to Hospitality Leads</button>
      </div>
    );
  }

  const ss = statusStyles(lead.status);
  const overdue = isOverdue(lead.next_followup_at) && !isToday(lead.next_followup_at);

  return (
    <div className="animate-fade-in space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Hospitality Leads
      </button>

      {actionError && (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
          <button onClick={() => setActionError(null)} className="ml-3 shrink-0 rounded-full p-1 text-red-400 hover:bg-red-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Header card */}
      <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-lg font-bold text-rose-700">{lead.name.charAt(0).toUpperCase()}</div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-gray-900">{lead.name}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-500">
                <span>{lead.phone}</span>
                {lead.email && <span>{lead.email}</span>}
                {lead.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {lead.city}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative inline-flex">
              <select
                value={lead.status}
                onChange={(e) => changeStatus(e.target.value as LeadStatus)}
                disabled={busy}
                className={`appearance-none rounded-full ${ss.bg} ${ss.text} px-3 py-1.5 pr-8 text-[12px] font-semibold ring-1 ${ss.ring} outline-none cursor-pointer hover:opacity-90`}
              >
                {HOSPITALITY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={() => setEditing(true)} className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-50"><Pencil className="h-4 w-4" /></button>
            <button onClick={deleteThisLead} className="grid h-9 w-9 place-items-center rounded-full border border-red-200 text-red-500 transition hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 text-[12px] text-gray-500">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium">{lead.source}</span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium">Priority: {lead.priority}</span>
          {lead.assigned_to && <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium">Assigned: {lead.assigned_to}</span>}
          {lead.budget && <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium">Budget: {lead.budget}</span>}
          {lead.booked_at && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Booked {formatDate(lead.booked_at)}
            </span>
          )}
          <span className={overdue ? 'ml-auto font-semibold text-red-600' : 'ml-auto text-gray-400'}>
            {isHospitalityFollowUpRequired(lead)
              ? (lead.next_followup_at ? `Next follow-up: ${overdue ? relativeDay(lead.next_followup_at) : formatDate(lead.next_followup_at)}` : 'No follow-up scheduled')
              : 'No follow-up required'}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <ActionButton icon={Phone} label="Call" color="text-emerald-600 bg-emerald-50" onClick={() => { window.open(`tel:${lead.phone}`); doAction('Called', 'Called ' + lead.name); }} disabled={busy} />
        <ActionButton icon={MessageCircle} label="WhatsApp" color="text-green-600 bg-green-50" onClick={() => { window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}`); doAction('WhatsApp Sent', 'Sent WhatsApp message'); }} disabled={busy} />
        <ActionButton icon={CalendarClock} label="Follow-up" color="text-amber-600 bg-amber-50" onClick={() => setFollowUpOpen(true)} disabled={busy} />
        <ActionButton icon={CheckCircle2} label="Mark Booked" color="text-rose-600 bg-rose-50" onClick={markBooked} disabled={busy || !!lead.booked_at} />
      </div>

      {/* Notes + timeline */}
      <div className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-bold tracking-tight text-gray-900">Activity Timeline</h2>
          <button onClick={() => setShowNoteInput((v) => !v)} className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-[12px] font-semibold text-rose-700 hover:bg-rose-100">
            <Plus className="h-3.5 w-3.5" /> Add Note
          </button>
        </div>

        {showNoteInput && (
          <div className="mb-4 flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
              maxLength={2000}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-rose-300"
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
            />
            <button onClick={addNote} disabled={!note.trim() || busy} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              <Check className="h-4 w-4" />
            </button>
          </div>
        )}

        {lead.notes && (
          <div className="mb-4 rounded-xl bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
            <User className="mr-1.5 inline h-3.5 w-3.5 text-gray-400" />{lead.notes}
          </div>
        )}

        {activities.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No activity yet.</div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
            <div className="space-y-4">
              {activities.map((a) => (
                <div key={a.id} className="relative animate-fade-up">
                  <span className="absolute -left-[22px] top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-white ring-2 ring-rose-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
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
                    {a.actor_name && <p className="mt-1 text-[11px] text-gray-400">by {a.actor_name}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {followUpOpen && (
        <FollowUpSheet
          current={lead.next_followup_at}
          onClose={() => setFollowUpOpen(false)}
          onPick={async (when, summary) => {
            setBusy(true);
            try {
              const { lead: updated } = await scheduleHospitalityFollowUp(lead, when, summary);
              setLead(updated);
              setActivities(await fetchHospitalityActivities(id));
              onChanged();
            } finally {
              setBusy(false);
              setFollowUpOpen(false);
            }
          }}
        />
      )}

      {editing && (
        <EditHospitalityLeadModal
          lead={lead}
          profiles={profiles}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { setLead(updated); setEditing(false); onChanged(); }}
        />
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, color, onClick, disabled }: { icon: typeof Phone; label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border border-black/5 bg-white py-4 text-[12px] font-semibold card-shadow transition hover:shadow-md disabled:opacity-50 ${color}`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}
