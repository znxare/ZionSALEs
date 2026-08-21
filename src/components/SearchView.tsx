import { useState, useMemo, useEffect } from 'react';
import { Search, X, ArrowRight, Phone } from 'lucide-react';
import type { Lead } from '@/lib/supabase';
import { statusStyles } from '@/lib/styles';

interface Props {
  leads: Lead[];
  onOpenLead: (id: string) => void;
  overlay?: boolean;
  onClose?: () => void;
}

export default function SearchView({ leads, onOpenLead, overlay, onClose }: Props) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (overlay) {
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [overlay, onClose]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return leads.filter((l) =>
      l.name.toLowerCase().includes(query) ||
      l.phone.toLowerCase().includes(query) ||
      (l.email ?? '').toLowerCase().includes(query) ||
      (l.city ?? '').toLowerCase().includes(query) ||
      l.source.toLowerCase().includes(query)
    ).slice(0, 20);
  }, [leads, q]);

  const container = overlay
    ? (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[10vh] backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-lg animate-scale-in overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {content()}
        </div>
      </div>
    )
    : <div className="animate-fade-in mx-auto w-full max-w-2xl">{content()}</div>;

  function content() {
    return (
      <>
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, email, city, source…"
            className="flex-1 bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-400"
          />
          {overlay && (
            <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim() === '' ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              Start typing to search across all leads.
            </div>
          ) : results.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              No leads match "{q}".
            </div>
          ) : (
            <div className="py-1">
              {results.map((l) => {
                const ss = statusStyles(l.status);
                return (
                  <button
                    key={l.id}
                    onClick={() => onOpenLead(l.id)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-gray-50"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                      {l.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-gray-900">{l.name}</div>
                      <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
                        <Phone className="h-3 w-3" /> {l.phone}
                        {l.city && <span>· {l.city}</span>}
                      </div>
                    </div>
                    <span className={`hidden shrink-0 rounded-full ${ss.bg} ${ss.text} px-2 py-0.5 text-[11px] font-medium ring-1 ${ss.ring} sm:inline`}>
                      {l.status}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  return container;
}
