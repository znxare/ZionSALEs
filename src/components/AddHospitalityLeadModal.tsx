import { useState } from 'react';
import { X, User, Phone, MapPin, Tag, ChevronRight, AlertTriangle, UserCog } from 'lucide-react';
import { createHospitalityLead, findHospitalityLeadByPhone, HOSPITALITY_SOURCES, type HospitalityLead, type HospitalitySource } from '@/lib/hospitality';
import { normalizePhone } from '@/lib/normalize';
import type { Profile } from '@/lib/supabase';

interface Props {
  profiles: Profile[];
  onClose: () => void;
  onCreated: (lead: HospitalityLead) => void;
}

export default function AddHospitalityLeadModal({ profiles, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState<HospitalitySource>('Website');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);

  async function submit() {
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    if (normalizePhone(phone).length < 7) {
      setError('Enter a valid phone number.');
      return;
    }
    try {
      setSaving(true);
      setError(null);

      if (!duplicate) {
        const existing = await findHospitalityLeadByPhone(phone);
        if (existing) {
          setDuplicate(existing);
          setSaving(false);
          return;
        }
      }

      const followUpAt = new Date(Date.now() + 2 * 86400000).toISOString();
      const lead = await createHospitalityLead({
        name: name.trim(),
        phone: phone.trim(),
        email: null,
        city: city.trim() || null,
        source,
        status: 'Warm',
        priority: 'Medium',
        budget: null,
        next_followup_at: followUpAt,
        last_contacted_at: null,
        last_activity_type: null,
        last_activity_at: null,
        assigned_to: assignedTo || null,
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
          <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">Add Hospitality Lead</h2>
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
              maxLength={100}
              className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-300"
            />
          </Field>

          <Field icon={Phone} label="Phone number">
            <input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setDuplicate(null); }}
              placeholder="+91 98765 43210"
              inputMode="tel"
              maxLength={20}
              className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-300"
            />
          </Field>

          <Field icon={MapPin} label="City">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Bengaluru"
              maxLength={60}
              className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-300"
            />
          </Field>

          <Field icon={Tag} label="Source">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as HospitalitySource)}
              className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none"
            >
              {HOSPITALITY_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field icon={UserCog} label="Assigned to">
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none"
            >
              <option value="">Unassigned</option>
              {profiles.map((p) => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}
            </select>
          </Field>

          <div className="rounded-xl bg-rose-50/60 px-4 py-2.5 text-[12px] text-rose-700">
            Next follow-up auto-scheduled for <span className="font-bold">2 days</span> from now. You can change it later.
          </div>

          {duplicate && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>A lead with this phone number already exists: <b>{duplicate.name}</b>. Save again to create a separate lead anyway.</span>
            </div>
          )}

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
            className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full bg-rose-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : duplicate ? 'Create Anyway' : 'Save Lead'}
            {!saving && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof User; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-150 bg-gray-50/60 px-4 py-3 transition focus-within:border-rose-300 focus-within:bg-white">
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
