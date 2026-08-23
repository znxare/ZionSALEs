import { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import type { Lead, LeadSource, LeadStatus, Campaign, Profile } from '@/lib/supabase';
import { updateLead, findLeadByPhone, SOURCES, STATUSES } from '@/lib/crm';
import { normalizePhone } from '@/lib/normalize';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  lead: Lead;
  campaigns: Campaign[];
  profiles: Profile[];
  onClose: () => void;
  onSaved: (lead: Lead) => void;
}

export default function EditLeadModal({ lead, campaigns, profiles, onClose, onSaved }: Props) {
  const currentCampaignId = lead.campaign_id && campaigns.some((c) => c.id === lead.campaign_id) ? lead.campaign_id : '';
  const [form, setForm] = useState({
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? '',
    city: lead.city ?? '',
    source: lead.source,
    status: lead.status,
    campaign_id: currentCampaignId,
    assigned_to: lead.assigned_to ?? '',
    notes: lead.notes ?? '',
    next_followup_at: lead.next_followup_at,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    if (normalizePhone(form.phone).length < 7) {
      setError('Enter a valid phone number.');
      return;
    }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!duplicate && normalizePhone(form.phone) !== normalizePhone(lead.phone)) {
        const existing = await findLeadByPhone(form.phone, lead.id);
        if (existing) {
          setDuplicate(existing);
          setSaving(false);
          return;
        }
      }
      const patch: Partial<Lead> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        city: form.city.trim() || null,
        source: form.source,
        status: form.status,
        campaign_id: form.campaign_id || null,
        assigned_to: form.assigned_to || null,
        notes: form.notes.trim() || null,
        next_followup_at: (form.status === 'Dead' || form.status === 'Junk') ? null : form.next_followup_at,
      };
      const updated = await updateLead(lead.id, patch);
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:animate-scale-in sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">Edit Lead</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Rahul Sharma" maxLength={100} />
            <Input label="Phone" value={form.phone} onChange={(v) => { setForm({ ...form, phone: v }); setDuplicate(null); }} placeholder="+91 98765 43210" maxLength={20} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="name@email.com" type="email" maxLength={100} />
            <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="Bengaluru" maxLength={60} />
          </div>

          <Select label="Lead source" value={form.source} onChange={(v) => setForm({ ...form, source: v as LeadSource })} options={SOURCES} />
          <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v as LeadStatus })} options={STATUSES} />
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Campaign</label>
            <select
              value={form.campaign_id}
              onChange={(e) => setForm({ ...form, campaign_id: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300"
            >
              {campaigns.length === 0 ? (
                <option value="">No campaigns available</option>
              ) : (
                campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
              )}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Assigned to</label>
            <select
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300"
            >
              <option value="">Unassigned</option>
              {profiles.map((p) => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}
            </select>
          </div>

          {form.status !== 'Dead' && form.status !== 'Junk' && (
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Next follow-up</label>
              <input
                type="datetime-local"
                value={(form.next_followup_at ?? '').slice(0, 16)}
                onChange={(e) => setForm({ ...form, next_followup_at: new Date(e.target.value).toISOString() })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Add notes…"
              maxLength={2000}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300"
            />
          </div>

          {duplicate && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Another lead already uses this phone number: <b>{duplicate.name}</b>. Save again to keep this number anyway.</span>
            </div>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-gray-100 bg-white px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-full bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full brand-gradient py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : duplicate ? 'Save Anyway' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text', maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; maxLength?: number }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-300"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
