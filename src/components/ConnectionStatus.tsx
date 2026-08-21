import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logout } from '@/components/Login';

type Status = 'checking' | 'connected' | 'error';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .then(({ error }) => {
        if (cancelled) return;
        setStatus(error ? 'error' : 'connected');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label = status === 'checking' ? 'Checking connection…' : status === 'connected' ? 'Database connected' : 'Connection error';
  const dot = status === 'checking' ? 'bg-gray-300' : status === 'connected' ? 'bg-emerald-400' : 'bg-red-500';

  return (
    <div className="mt-6 rounded-2xl border border-gray-200/60 bg-warm-surface-2 p-3">
      <div className="flex items-center gap-2">
        <span className={'h-2 w-2 shrink-0 rounded-full ' + dot + (status === 'checking' ? ' animate-pulse' : '')} />
        <span className="text-[12px] font-medium text-gray-600">{label}</span>
      </div>
      <button
        onClick={logout}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-500 ring-1 ring-gray-200/60 transition hover:bg-gray-50 hover:text-gray-700"
      >
        <LogOut className="h-3.5 w-3.5" />
        Log out
      </button>
    </div>
  );
}
