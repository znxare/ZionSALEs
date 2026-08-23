import { useState } from 'react';
import { Lock, UserPlus } from 'lucide-react';
import { signIn, signUp } from '@/lib/auth';

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password.trim() || (mode === 'signup' && !fullName.trim())) {
      setError('Fill in all required fields.');
      return;
    }
    try {
      setBusy(true);
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        onSuccess();
      } else {
        await signUp(email.trim(), password, fullName, role);
        setInfo('Account created. If email confirmation is required, check your inbox — otherwise, sign in now.');
        setMode('signin');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200/60 bg-white p-7 card-shadow-lg">
        <div className="grid h-11 w-11 place-items-center rounded-2xl brand-gradient text-white">
          {mode === 'signin' ? <Lock className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-gray-900">Zion Hills CRM</h1>
        <p className="mt-1 text-sm text-gray-500">{mode === 'signin' ? 'Sign in to continue.' : 'Create your account.'}</p>

        <form onSubmit={submit} className="mt-6 space-y-3.5">
          {mode === 'signup' && (
            <>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-orange-300"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Role (optional)</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Asst. Sales Manager"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-orange-300"
                />
              </div>
            </>
          )}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={mode === 'signin'}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-orange-300"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-orange-300"
            />
          </div>

          {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
          {info && <p className="text-[13px] font-medium text-emerald-600">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl brand-gradient py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}
          className="mt-4 w-full text-center text-[13px] font-medium text-gray-500 hover:text-gray-700"
        >
          {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
