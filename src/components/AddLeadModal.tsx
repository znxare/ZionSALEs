import { useState } from 'react';
import { X, User, Phone, MapPin, Megaphone, ChevronRight, Tag } from 'lucide-react';
import { createLead, sourceFromCampaignType, smartDefaults, type Lead, type Campaign } from '@/lib/crm';
import type { LeadPriority } from '@/lib/supabase';

interface Props {
  campaigns: Campaign[];
  onClose: () => void;
  onCreated: (lead: Lead) => void;
}

export default function AddLeadModal({ campaigns, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [source, setSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCampaign = campaigns.find((c) => c.id === campaignId) ?? null;
  const derivedSource = selectedCampaign ? sourceFromCampaignType(selectedCampaign.type) : 'Walk-in';
  const effectiveSource = source.trim() || derivedSource;
  const defaults = smartDefaults(effectiveSource);

  async function submit() {
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const followUpAt = new Date(Date.now() + 2 * 86400000).toISOString();
      const lead = await createLead({
        name: name.trim(),
        phone: phone.trim(),
        email: null,
        city: city.trim() || null,
        source: effectiveSource,
        status: defaults.status,
        priority: 'Medium' as LeadPriority,
        budget: null,
        budget_lakhs: null,
        project_interest: null,
        campaign_id: campaignId || null,
        next_followup_at: followUpAt,
        last_contacted_at: null,
        last_activity_type: null,
        last_activity_at: null,
        assigned_to: null,
        site_visit_at: null,
        booked_at: null,
        notes: null,
      });
      onCreated(lead);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save lead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md animate-slide-up overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:animate-scale-in sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">Add New Lead</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <Field icon={User} label="Full name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rahul Sharma"
              className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-300"
            />
          </Field>

          <Field icon={Phone} label="Phone number">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              inputMode="tel"
              className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-300"
            />
          </Field>

          <Field icon={MapPin} label="City">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Bengaluru"
              className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-300"
            />
          </Field>

          <Field icon={Tag} label="Source">
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={derivedSource}
              className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-300"
            />
          </Field>
          {selectedCampaign && !source.trim() && (
            <p className="-mt-2 text-[12px] text-gray-400">
              Default from campaign: <span className="font-semibold text-emerald-600">{derivedSource}</span> — override by typing above.
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Campaign</label>
            <div className="flex items-center gap-3 rounded-2xl border border-gray-150 bg-gray-50/60 px-4 py-3 transition focus-within:border-emerald-300 focus-within:bg-white">
              <Megaphone className="h-5 w-5 shrink-0 text-gray-400" />
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none"
              >
                <option value="">Walk-in / Organic</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50/60 px-4 py-2.5 text-[12px] text-emerald-700">
            Next follow-up auto-scheduled for <span className="font-bold">2 days</span> from now. You can change it later.
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-full bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full brand-gradient py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Lead'}
            {!saving && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof User; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-150 bg-gray-50/60 px-4 py-3 transition focus-within:border-emerald-300 focus-within:bg-white">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 shrink-0 text-gray-400" />
        <div className="min-w-0 flex-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</label>
          {children}
        </div>
      </div>
    </div>
  );
}
