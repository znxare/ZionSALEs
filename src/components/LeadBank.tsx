import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Phone, Trash2, X, Check, Search,
  Loader2, MessageCircle,
} from 'lucide-react';
import type { Campaign, LeadBankEntry, LeadBankStatus, LeadStatus } from '@/lib/supabase';
import {
  fetchLeadBank, updateLeadBankEntry, deleteLeadBankEntry,
  convertLeadBankToLeadSafe, STATUSES, recordAction, fetchLead, UNASSIGNED_CAMPAIGN_LABEL,
} from '@/lib/crm';
import { phoneCountryFlag } from '@/lib/normalize';
import Private from './Private';

interface Props {
  campaigns: Campaign[];
  onChanged: () => void;
}

export default function LeadBank({ campaigns, onChanged }: Props) {
  const [entries, setEntries] = useState<LeadBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [callEntry, setCallEntry] = useState<LeadBankEntry | null>(null);
  const [assignCampaign, setAssignCampaign] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchLeadBank();
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => `${e.name} ${e.phone}`.toLowerCase().includes(q));
  }, [entries, search]);

  async function handleConvert(entry: LeadBankEntry, status: LeadStatus, campaignId: string | null, note: string) {
    setBusy(true);
    setConvertError(null);
    try {
      const noteText = note.trim();
      if (noteText) {
        const existing = entry.notes ?? '';
        const stamped = `[${new Date().toLocaleString('en-IN')}] ${noteText}`;
        const updated = existing ? `${existing}\n${stamped}` : stamped;
        await updateLeadBankEntry(entry.id, { notes: updated, last_contacted_at: new Date().toISOString() });
        entry = { ...entry, notes: updated };
      }
      const lead = await convertLeadBankToLeadSafe(entry, campaignId, status);
      // If lead already existed (duplicate phone), sync notes to the existing lead's timeline
      if (noteText) {
        const freshLead = await fetchLead(lead.id);
        if (freshLead) {
          await recordAction(freshLead, 'Note Added', noteText, {});
        }
      }
      onChanged();
      await load();
      setCallEntry(null);
      setAssignCampaign(null);
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : 'Could not save this call. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this lead from the bank?')) return;
    await deleteLeadBankEntry(id);
    await load();
  }

  const [busy, setBusy] = useState(false);

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Lead Bank</h1>
          <p className="text-[13px] text-gray-400">Raw leads from Google Sheets. Qualify them before they enter your pipeline.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full rounded-full border border-black/5 bg-white py-2.5 pl-11 pr-4 text-sm font-medium text-gray-900 outline-none card-shadow placeholder:text-gray-400 focus:border-emerald-200"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white card-shadow">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="sticky top-0 bg-gray-50/90 backdrop-blur">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Added</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No leads in the bank yet.</td></tr>
                ) : filtered.map((e) => (
                  <tr key={e.id} className="group border-t border-gray-100 transition hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-semibold text-gray-900">{e.name}</td>
                    <td className="px-4 py-3">
                      <a href={`tel:${e.phone}`} className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-600 hover:underline">
                        {phoneCountryFlag(e.phone) && <span title={phoneCountryFlag(e.phone)?.name}>{phoneCountryFlag(e.phone)?.flag}</span>}
                        <Private>{e.phone}</Private>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-500">{e.source ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${bankStatusTint(e.status)}`}>{e.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-400">{new Date(e.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => { setCallEntry(e); setAssignCampaign(e.campaign_id); }}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <Phone className="h-3.5 w-3.5" /> Log Call
                        </button>
                        <button onClick={() => handleDelete(e.id)} className="rounded-lg p-1.5 text-gray-300 transition hover:bg-red-50 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Call result / qualify modal */}
      {callEntry && (
        <CallQualifyModal
          entry={callEntry}
          campaigns={campaigns}
          assignCampaign={assignCampaign}
          setAssignCampaign={setAssignCampaign}
          busy={busy}
          error={convertError}
          onClose={() => { setCallEntry(null); setConvertError(null); }}
          onConvert={handleConvert}
        />
      )}
    </div>
  );
}

function bankStatusTint(s: LeadBankStatus): string {
  switch (s) {
    case 'Hot': return 'bg-red-50 text-red-700';
    case 'Cold': return 'bg-blue-50 text-blue-700';
    case 'Converted': return 'bg-emerald-50 text-emerald-700';
    case 'Not Interested': return 'bg-gray-100 text-gray-500';
    case 'Not Reachable': return 'bg-amber-50 text-amber-700';
    default: return 'bg-sky-50 text-sky-700';
  }
}

function CallQualifyModal({
  entry, campaigns, assignCampaign, setAssignCampaign, busy, error, onClose, onConvert,
}: {
  entry: LeadBankEntry;
  campaigns: Campaign[];
  assignCampaign: string | null;
  setAssignCampaign: (v: string | null) => void;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConvert: (entry: LeadBankEntry, status: LeadStatus, campaignId: string | null, note: string) => void;
}) {
  const [selected, setSelected] = useState<LeadStatus | null>(null);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md animate-fade-up rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-gray-900">Log Call</h3>
            <p className="text-[13px] text-gray-400">{entry.name} · <Private>{entry.phone}</Private></p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 flex gap-2">
          <a href={`tel:${entry.phone}`} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-orange-50 py-3 text-sm font-semibold text-orange-700 ring-1 ring-orange-200 transition hover:bg-orange-100">
            <Phone className="h-4 w-4" /> Call Now
          </a>
          <a
            href={`https://wa.me/${entry.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-green-50 py-3 text-sm font-semibold text-green-700 ring-1 ring-green-200 transition hover:bg-green-100"
          >
            <MessageCircle className="h-4 w-4" /> Send WhatsApp
          </a>
        </div>

        <p className="mb-3 text-[13px] font-semibold text-gray-500">Select status</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setSelected(s)}
              className={`rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${selected === s ? 'brand-gradient text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s}
            </button>
          ))}
        </div>

        {selected && (
          <div className="mb-4 animate-fade-up">
            <label className="mb-1 block text-[12px] font-semibold text-gray-500">Call Notes</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What did the lead say? Add details here…"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300"
            />
            <label className="mb-1 mt-3 block text-[12px] font-semibold text-gray-500">Assign to Campaign</label>
            <select
              value={assignCampaign ?? ''}
              onChange={(e) => setAssignCampaign(e.target.value || null)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300"
            >
              <option value="">— {UNASSIGNED_CAMPAIGN_LABEL} —</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="mt-1.5 text-[11px] text-gray-400">This lead will be moved to All Leads with the selected campaign.</p>
          </div>
        )}

        {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-full bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-200">Cancel</button>
          <button
            onClick={() => selected && onConvert(entry, selected, assignCampaign, note)}
            disabled={!selected || busy}
            className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full brand-gradient py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {busy ? 'Saving…' : 'Save & Qualify'}
          </button>
        </div>
      </div>
    </div>
  );
}
