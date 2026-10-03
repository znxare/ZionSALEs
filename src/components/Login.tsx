import { useState } from 'react';
import { Lock } from 'lucide-react';
import { signIn } from '@/lib/auth';

// Sign-in only: new logins are created by the admin in Settings → Team, so
// nobody can give themselves access from the login page.
export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Fill in all required fields.');
      return;
    }
    try {
      setBusy(true);
      await signIn(email.trim(), password);
      onSuccess();
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
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-gray-900">Zion Hills CRM</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to continue.</p>

        <form onSubmit={submit} className="mt-6 space-y-3.5">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
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

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl brand-gradient py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          >
            {busy ? 'Please wait…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-[13px] text-gray-400">Need access? Ask your admin to add you.</p>
      </div>
    </div>
  );
}
