import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Phone, Trash2, Upload, X, Check, Flame, Snowflake, Sun, Search,
  ClipboardPaste, Megaphone, User, Loader2,
} from 'lucide-react';
import type { Campaign, LeadBankEntry, LeadBankStatus, LeadStatus } from '@/lib/supabase';
import {
  fetchLeadBank, createLeadBankEntry, updateLeadBankEntry, deleteLeadBankEntry,
  convertLeadBankToLeadSafe, fetchAllLeadBankPhones, fetchAllLeadsPhones,
  STATUSES, recordAction, fetchLead,
} from '@/lib/crm';
import { normalizePhone, phoneCountryFlag } from '@/lib/normalize';

interface Props {
  campaigns: Campaign[];
  onChanged: () => void;
}

export default function LeadBank({ campaigns, onChanged }: Props) {
  const [entries, setEntries] = useState<LeadBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [callEntry, setCallEntry] = useState<LeadBankEntry | null>(null);
  const [assignCampaign, setAssignCampaign] = useState<string | null>(null);

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

  const campaignMap = useMemo(() => {
    const m = new Map<string, Campaign>();
    campaigns.forEach((c) => m.set(c.id, c));
    return m;
  }, [campaigns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => `${e.name} ${e.phone}`.toLowerCase().includes(q));
  }, [entries, search]);

  const stats = useMemo(() => ({
    total: entries.length,
    newCount: entries.filter((e) => e.status === 'New').length,
    hot: entries.filter((e) => e.status === 'Hot').length,
    cold: entries.filter((e) => e.status === 'Cold').length,
    converted: entries.filter((e) => e.status === 'Converted').length,
  }), [entries]);

  async function handleConvert(entry: LeadBankEntry, status: LeadStatus, campaignId: string | null, note: string) {
    setBusy(true);
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
    } finally {
      setBusy(false);
      setCallEntry(null);
      setAssignCampaign(null);
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
        <button
          onClick={() => setPasteOpen(true)}
          className="flex items-center gap-1.5 rounded-full brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          <ClipboardPaste className="h-4 w-4" /> Paste from Excel
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatPill icon={User} label="Total" value={stats.total} tint="text-gray-700 bg-gray-100" />
        <StatPill icon={Sun} label="New" value={stats.newCount} tint="text-sky-700 bg-sky-50" />
        <StatPill icon={Flame} label="Hot" value={stats.hot} tint="text-red-700 bg-red-50" />
        <StatPill icon={Snowflake} label="Cold" value={stats.cold} tint="text-blue-700 bg-blue-50" />
        <StatPill icon={Check} label="Converted" value={stats.converted} tint="text-emerald-700 bg-emerald-50" />
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
                        {e.phone}
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

      {/* Paste from Excel modal */}
      {pasteOpen && (
        <PasteFromExcelModal
          campaigns={campaigns}
          onClose={() => setPasteOpen(false)}
          onDone={async () => { await load(); setPasteOpen(false); }}
        />
      )}

      {/* Call result / qualify modal */}
      {callEntry && (
        <CallQualifyModal
          entry={callEntry}
          campaigns={campaigns}
          assignCampaign={assignCampaign}
          setAssignCampaign={setAssignCampaign}
          busy={busy}
          onClose={() => setCallEntry(null)}
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

function StatPill({ icon: Icon, label, value, tint }: { icon: typeof User; label: string; value: number; tint: string }) {
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

function PasteFromExcelModal({ campaigns, onClose, onDone }: { campaigns: Campaign[]; onClose: () => void; onDone: () => void }) {
  const [raw, setRaw] = useState('');
  const [campaignId, setCampaignId] = useState<string>('');
  const [source, setSource] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const [skippedDup, setSkippedDup] = useState(0);
  const [dupChecked, setDupChecked] = useState(false);
  const [existingPhones, setExistingPhones] = useState<Set<string>>(new Set());
  const [inFileDupes, setInFileDupes] = useState<Set<string>>(new Set());

  function parseLines(text: string): { name: string; phone: string; city?: string; email?: string }[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows: { name: string; phone: string; city?: string; email?: string }[] = [];
    for (const line of lines) {
      const parts = line.includes('\t') ? line.split('\t') : line.split(',').map((s) => s.trim());
      if (parts.length < 2) continue;
      const name = parts[0].trim();
      const phone = parts[1].trim().replace(/[^\d+]/g, '');
      if (!name || !phone) continue;
      const email = parts.find((p) => p.includes('@'));
      const city = parts[2]?.trim();
      rows.push({ name, phone, city: city || undefined, email: email || undefined });
    }
    return rows;
  }

  const preview = useMemo(() => parseLines(raw), [raw]);

  const previewWithFlags = useMemo(() => {
    return preview.map((r) => {
      const norm = normalizePhone(r.phone);
      const isDupInFile = inFileDupes.has(norm);
      const isDupExisting = existingPhones.has(norm);
      return { ...r, normalized: norm, isDupInFile, isDupExisting };
    });
  }, [preview, inFileDupes, existingPhones]);

  const newRows = previewWithFlags.filter((r) => !r.isDupInFile && !r.isDupExisting);
  const dupCount = previewWithFlags.length - newRows.length;

  async function checkDuplicates() {
    setImporting(true);
    try {
      const [bankPhones, leadPhones] = await Promise.all([fetchAllLeadBankPhones(), fetchAllLeadsPhones()]);
      const existing = new Set<string>();
      for (const key of bankPhones.keys()) existing.add(key);
      for (const key of leadPhones.keys()) existing.add(key);
      setExistingPhones(existing);

      const inFile = new Set<string>();
      const seen = new Set<string>();
      for (const r of preview) {
        const norm = normalizePhone(r.phone);
        if (seen.has(norm)) inFile.add(norm);
        seen.add(norm);
      }
      setInFileDupes(inFile);
      setDupChecked(true);
    } finally {
      setImporting(false);
    }
  }

  async function doImport() {
    setImporting(true);
    try {
      const rows = newRows;
      let importedCount = 0;
      for (const r of rows) {
        await createLeadBankEntry({
          name: r.name,
          phone: r.phone,
          email: r.email ?? null,
          city: r.city ?? null,
          source: source || null,
          campaign_id: campaignId || null,
        });
        importedCount++;
      }
      setImported(importedCount);
      setSkippedDup(preview.length - importedCount);
      setTimeout(() => { onDone(); }, 1200);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl animate-fade-up overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-gray-900">Paste from Excel</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        {imported > 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-100"><Check className="h-6 w-6 text-emerald-600" /></div>
            <p className="font-display text-lg font-bold text-gray-900">{imported} leads added to the bank</p>
            {skippedDup > 0 && <p className="mt-1 text-[13px] text-amber-600">{skippedDup} duplicate{skippedDup > 1 ? 's' : ''} skipped</p>}
          </div>
        ) : (
          <>
            <p className="mb-4 text-[13px] text-gray-500">
              Paste rows from your Google Sheet. Each line should have: <span className="font-semibold">Name, Phone</span> (tab or comma separated). City and email are optional.
            </p>

            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-gray-500">Assign to Campaign (optional)</label>
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300">
                  <option value="">— None —</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-gray-500">Source Label (optional)</label>
                <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Facebook, Google, Organic" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300" />
              </div>
            </div>

            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'Name\tPhone\tCity\nJohn Doe\t9876543210\tMumbai\nJane Smith\t9123456780\tDelhi'}
              rows={8}
              className="mb-3 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-[13px] outline-none focus:border-emerald-300"
            />

            {preview.length > 0 && (
              <div className="mb-4 rounded-xl bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-gray-500">{preview.length} rows detected</p>
                  {dupChecked && dupCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">{dupCount} duplicate{dupCount > 1 ? 's' : ''} will be skipped</span>
                  )}
                  {dupChecked && dupCount === 0 && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">No duplicates found</span>
                  )}
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {previewWithFlags.slice(0, 8).map((r, i) => (
                    <div key={i} className="flex items-center gap-3 py-0.5 text-[12px] text-gray-600">
                      <span className={`font-medium ${r.isDupInFile || r.isDupExisting ? 'text-amber-600' : 'text-gray-700'}`}>{r.name}</span>
                      <span className={r.isDupInFile || r.isDupExisting ? 'text-amber-500' : 'text-gray-500'}>{r.phone}</span>
                      {r.city && <span className="text-gray-400">{r.city}</span>}
                      {r.isDupInFile && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Dup in file</span>}
                      {r.isDupExisting && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Already exists</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!dupChecked ? (
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 rounded-full bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-200">Cancel</button>
                <button
                  onClick={checkDuplicates}
                  disabled={importing || preview.length === 0}
                  className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full brand-gradient py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {importing ? 'Checking…' : 'Check for Duplicates'}
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setDupChecked(false)} className="flex-1 rounded-full bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-200">Back</button>
                <button
                  onClick={doImport}
                  disabled={importing || newRows.length === 0}
                  className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full brand-gradient py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importing ? 'Importing…' : `Import ${newRows.length} Lead${newRows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CallQualifyModal({
  entry, campaigns, assignCampaign, setAssignCampaign, busy, onClose, onConvert,
}: {
  entry: LeadBankEntry;
  campaigns: Campaign[];
  assignCampaign: string | null;
  setAssignCampaign: (v: string | null) => void;
  busy: boolean;
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
            <p className="text-[13px] text-gray-400">{entry.name} · {entry.phone}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4">
          <a href={`tel:${entry.phone}`} className="flex w-full items-center justify-center gap-2 rounded-full brand-gradient py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95">
            <Phone className="h-4 w-4" /> Dial {entry.phone}
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
              <option value="">— Organic / Walk-in —</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="mt-1.5 text-[11px] text-gray-400">This lead will be moved to All Leads with the selected campaign.</p>
          </div>
        )}

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
