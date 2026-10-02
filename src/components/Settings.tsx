import { useState } from 'react';
import { Settings as SettingsIcon, User, KeyRound, Monitor, Users, LogOut, Check } from 'lucide-react';
import type { Profile } from '@/lib/supabase';
import { changePassword, type CurrentUser } from '@/lib/auth';
import { usePresentationMode, setPresentationMode } from '@/lib/presentationMode';

interface Props {
  user: CurrentUser;
  profiles: Profile[];
  onSignOut: () => void;
}

export default function Settings({ user, profiles, onSignOut }: Props) {
  const presentationMode = usePresentationMode();

  return (
    <div className="animate-fade-in mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gray-100 text-gray-600">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Settings</h1>
          <p className="text-[13px] text-gray-400">Your account, display preferences and team.</p>
        </div>
      </div>

      <Section icon={User} title="My profile">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Field label="Name" value={user.full_name} />
          <Field label="Email" value={user.email ?? '—'} />
          <Field label="Role" value={user.role} />
        </dl>
      </Section>

      <Section icon={KeyRound} title="Change password">
        <PasswordForm />
      </Section>

      <Section icon={Monitor} title="Display">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-semibold text-gray-900">Presentation mode</span>
            <span className="block text-[12px] text-gray-400">Blurs phone numbers and emails everywhere, for screenshots and screen sharing. Saved on this device only.</span>
          </span>
          <button
            role="switch"
            aria-checked={presentationMode}
            onClick={() => setPresentationMode(!presentationMode)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${presentationMode ? 'bg-orange-500' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${presentationMode ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </label>
      </Section>

      <Section icon={Users} title={`Team (${profiles.length})`}>
        {profiles.length === 0 ? (
          <p className="text-sm text-gray-400">No team members found.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {profiles.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-50 text-[12px] font-bold text-orange-700">
                    {p.full_name.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {p.full_name}
                    {p.id === user.id && <span className="ml-1.5 text-[11px] font-normal text-gray-400">(you)</span>}
                  </span>
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">{p.role}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12px] text-gray-400">New logins are added in Supabase → Authentication.</p>
      </Section>

      <button
        onClick={onSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600 card-shadow transition hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

function PasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setSaving(true);
    try {
      await changePassword(password);
      setPassword('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-orange-300';
  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input type="password" autoComplete="new-password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        <input type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {done && <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600"><Check className="h-4 w-4" /> Password changed.</p>}
      <button
        type="submit"
        disabled={saving || !password || !confirm}
        className="rounded-full brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Update password'}
      </button>
    </form>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 card-shadow">
      <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold tracking-tight text-gray-900">
        <Icon className="h-4 w-4 text-gray-400" /> {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}
