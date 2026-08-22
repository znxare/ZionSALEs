import { useState } from 'react';
import { Lock } from 'lucide-react';

const VALID_USERNAME = 'Zion';
const VALID_PASSWORD = 'Zion@championreef';
const AUTH_KEY = 'zion_crm_authed';

export function isAuthed(): boolean {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Enter your username and password.');
      return;
    }
    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      localStorage.setItem(AUTH_KEY, 'true');
      onSuccess();
    } else {
      setError('Incorrect username or password.');
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
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
            className="w-full rounded-xl brand-gradient py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
