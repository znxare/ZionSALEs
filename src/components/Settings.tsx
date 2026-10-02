import { Fragment, useState } from 'react';
import { Settings as SettingsIcon, User, KeyRound, Monitor, Users, LogOut, Check, UserPlus, Mail, Loader2, LayoutGrid } from 'lucide-react';
import type { Profile } from '@/lib/supabase';
import { changePassword, isRecoveringPassword, sendPasswordReset, type CurrentUser } from '@/lib/auth';
import {
  ACCESS_LABELS, CONFIGURABLE_MODULES, getModuleVisibility, resolveAccess, setModuleVisibility, usePermissions,
  type AccessLevel, type ModuleVisibility,
} from '@/lib/access';
import { saveModuleVisibility } from '@/lib/appSettings';
import { addMember, setMemberAccess } from '@/lib/users';
import { usePresentationMode, setPresentationMode } from '@/lib/presentationMode';

interface Props {
  user: CurrentUser;
  profiles: Profile[];
  onSignOut: () => void;
  onTeamChanged: () => void;
}

export default function Settings({ user, profiles, onSignOut, onTeamChanged }: Props) {
  const presentationMode = usePresentationMode();
  const can = usePermissions();
  const recovering = isRecoveringPassword();

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
          <Field label="Access" value={levelLabel(user.access)} />
        </dl>
      </Section>

      {recovering && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
          Set a new password below to finish resetting it.
        </div>
      )}
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

      {can.canManageUsers && <ModuleAccess />}

      {can.canManageUsers ? (
        <TeamManager profiles={profiles} currentUserId={user.id} onChanged={onTeamChanged} />
      ) : (
        <Section icon={Users} title={`Team (${activeCount(profiles)})`}>
          <TeamList profiles={profiles} currentUserId={user.id} />
        </Section>
      )}

      <button
        onClick={onSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600 card-shadow transition hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

// Admin: tick which pages Team and Viewer can see. Saved team-wide.
function ModuleAccess() {
  const [draft, setDraft] = useState<ModuleVisibility>(() => getModuleVisibility());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const roles = ['team', 'viewer'] as const;
  const groups = [...new Set(CONFIGURABLE_MODULES.map((m) => m.group))];

  function toggle(role: (typeof roles)[number], id: string) {
    setMessage(null);
    setDraft((d) => {
      const hidden = d[role].includes(id) ? d[role].filter((x) => x !== id) : [...d[role], id];
      return { ...d, [role]: hidden };
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await saveModuleVisibility(draft);
      setModuleVisibility(draft);
      setMessage({ kind: 'ok', text: 'Saved. Team members see the change the next time the app refreshes.' });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section icon={LayoutGrid} title="Module access">
      <p className="-mt-2 mb-4 text-[12px] text-gray-400">Choose which pages each role can open. Admin always sees everything; Dashboard and Settings are always visible.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-400">
              <th className="py-2 text-left font-semibold">Page</th>
              {roles.map((r) => <th key={r} className="w-20 py-2 text-center font-semibold">{ACCESS_LABELS[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g}>
                <tr><td colSpan={3} className="pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">{g}</td></tr>
                {CONFIGURABLE_MODULES.filter((m) => m.group === g).map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="py-2 text-gray-800">{m.label}</td>
                    {roles.map((r) => (
                      <td key={r} className="py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${ACCESS_LABELS[r]} can see ${g} ${m.label}`}
                          checked={!draft[r].includes(m.id)}
                          onChange={() => toggle(r, m.id)}
                          className="h-4 w-4 accent-orange-600"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {message && <p className={`mt-3 text-sm font-medium ${message.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-full brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save module access'}
      </button>
    </Section>
  );
}

function accessOf(p: Profile): AccessLevel {
  return resolveAccess(p.email, p.access_level);
}

function activeCount(profiles: Profile[]): number {
  return profiles.filter((p) => accessOf(p) !== 'removed').length;
}

function levelLabel(level: AccessLevel): string {
  return level === 'removed' ? 'Removed' : ACCESS_LABELS[level];
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-50 text-[12px] font-bold text-orange-700">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function TeamList({ profiles, currentUserId }: { profiles: Profile[]; currentUserId: string }) {
  const active = profiles.filter((p) => accessOf(p) !== 'removed');
  if (active.length === 0) return <p className="text-sm text-gray-400">No team members found.</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {active.map((p) => (
        <li key={p.id} className="flex items-center justify-between py-2.5">
          <span className="flex items-center gap-2.5">
            <Avatar name={p.full_name} />
            <span className="text-sm font-medium text-gray-900">
              {p.full_name}
              {p.id === currentUserId && <span className="ml-1.5 text-[11px] font-normal text-gray-400">(you)</span>}
            </span>
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">{levelLabel(accessOf(p))}</span>
        </li>
      ))}
    </ul>
  );
}

// Admin: change roles, remove/restore people, send password resets, add members.
function TeamManager({ profiles, currentUserId, onChanged }: { profiles: Profile[]; currentUserId: string; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const sorted = [...profiles].sort((a, b) =>
    Number(accessOf(a) === 'removed') - Number(accessOf(b) === 'removed') || a.full_name.localeCompare(b.full_name));
  // The roles SQL adds profiles.access_level; until it runs, role changes can't save.
  const migrated = profiles.some((p) => 'access_level' in p);

  async function run(id: string, action: () => Promise<void>, ok: string) {
    setBusyId(id);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: 'ok', text: ok });
      onChanged();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Section icon={Users} title={`Team (${activeCount(profiles)})`}>
      {!migrated && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          Roles can't be saved yet — the access-levels SQL hasn't been run in Supabase.
        </p>
      )}
      <ul className="divide-y divide-gray-100">
        {sorted.map((p) => {
          const level = accessOf(p);
          const isSelf = p.id === currentUserId;
          const fixedAdmin = resolveAccess(p.email, null) === 'admin';
          return (
            <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 py-3 ${level === 'removed' ? 'opacity-50' : ''}`}>
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar name={p.full_name} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {p.full_name}{isSelf && <span className="ml-1.5 text-[11px] font-normal text-gray-400">(you)</span>}
                  </span>
                  <span className="block truncate text-[12px] text-gray-400">{p.email ?? 'Email appears after their next sign-in'}</span>
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                {busyId === p.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                {level === 'removed' ? (
                  <button
                    onClick={() => run(p.id, () => setMemberAccess(p.id, 'team'), `${p.full_name} restored as Team.`)}
                    disabled={busyId !== null}
                    className="rounded-full border border-gray-200 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Restore
                  </button>
                ) : (
                  <>
                    <select
                      value={level}
                      disabled={busyId !== null || fixedAdmin}
                      onChange={(e) => {
                        const next = e.target.value as AccessLevel;
                        void run(p.id, () => setMemberAccess(p.id, next), `${p.full_name} is now ${levelLabel(next)}.`);
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[12px] font-medium text-gray-700 outline-none disabled:bg-gray-50"
                      title={fixedAdmin ? 'This account is always Admin' : 'Change access'}
                    >
                      {(Object.keys(ACCESS_LABELS) as (keyof typeof ACCESS_LABELS)[]).map((k) => (
                        <option key={k} value={k}>{ACCESS_LABELS[k]}</option>
                      ))}
                    </select>
                    {p.email && (
                      <button
                        onClick={() => run(p.id, () => sendPasswordReset(p.email!), `Password reset email sent to ${p.email}.`)}
                        disabled={busyId !== null}
                        title="Email a password reset link"
                        className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                    )}
                    {!isSelf && !fixedAdmin && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${p.full_name}? They will be signed out and can't log in until restored.`)) {
                            void run(p.id, () => setMemberAccess(p.id, 'removed'), `${p.full_name} removed.`);
                          }
                        }}
                        disabled={busyId !== null}
                        className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {message && <p className={`mt-3 text-sm font-medium ${message.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
      {adding ? (
        <AddMemberForm
          onCancel={() => setAdding(false)}
          onAdded={(name) => { setAdding(false); setMessage({ kind: 'ok', text: `${name} added.` }); onChanged(); }}
        />
      ) : (
        <button onClick={() => setAdding(true)} className="mt-4 flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <UserPlus className="h-4 w-4" /> Add team member
        </button>
      )}
    </Section>
  );
}

function AddMemberForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: (name: string) => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [access, setAccessLevel] = useState<AccessLevel>('team');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim()) { setError('Name and email are required.'); return; }
    if (password.length < 8) { setError('Temporary password needs at least 8 characters.'); return; }
    setSaving(true);
    try {
      await addMember({ fullName, email, password, access });
      onAdded(fullName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this member.');
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-orange-300';
  return (
    <form onSubmit={save} className="mt-4 space-y-3 rounded-xl bg-gray-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={input} />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        <input type="text" autoComplete="off" placeholder="Temporary password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        <select value={access} onChange={(e) => setAccessLevel(e.target.value as AccessLevel)} className={input}>
          <option value="team">Team</option>
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <p className="text-[12px] text-gray-400">Share the temporary password with them; they can change it in Settings after signing in.</p>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-600 ring-1 ring-gray-200">Cancel</button>
        <button type="submit" disabled={saving} className="rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Adding…' : 'Add member'}
        </button>
      </div>
    </form>
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
