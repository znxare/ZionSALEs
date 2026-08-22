import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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
    </div>
  );
}
