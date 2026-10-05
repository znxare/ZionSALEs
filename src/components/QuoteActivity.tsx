import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, X, Phone, MessageCircle, ExternalLink, Search } from 'lucide-react';
import { onQuoteOpened, fetchQuoteLink, countViews, fetchQuoteActivity, quoteUrl, type QuoteActivity } from '@/lib/quoteLinks';
import { findPlot } from '@/lib/plotMap';
import type { CurrentUser } from '@/lib/auth';
import { getPresentationMode } from '@/lib/presentationMode';

// "Rohit just opened Plot 622 — 3rd time": the best moment to call.

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

function nth(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

function waLink(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}`;
}

type Alert = { key: number; linkId: string; buyer: string; plotNo: string; views: number; phone: string | null };

/** Live pop-ups when a buyer opens a quote — for whoever sent it, and the admin. */
export function QuoteAlerts({ user }: { user: CurrentUser }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    return onQuoteOpened(async (linkId) => {
      const link = await fetchQuoteLink(linkId);
      if (!link) return;
      if (link.sender_id !== user.id && user.access !== 'admin') return;
      // Never pop another buyer's name up on a screen a buyer is looking at.
      if (getPresentationMode() || document.querySelector('[data-buyer-facing]')) return;
      const views = await countViews(linkId);
      const plot = findPlot(link.plot_id);
      const a: Alert = { key: Date.now() + Math.random(), linkId, buyer: link.buyer_name || 'A buyer', plotNo: plot?.plotNo ?? link.plot_id, views, phone: link.buyer_phone };
      setAlerts((prev) => [a, ...prev.filter((x) => x.linkId !== linkId)].slice(0, 3));
      window.setTimeout(() => setAlerts((prev) => prev.filter((x) => x.key !== a.key)), 30000);
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`${a.buyer} opened Plot ${a.plotNo}`, { body: a.views > 1 ? `${nth(a.views)} time — a good moment to call.` : 'First look — a good moment to call.' });
        }
      } catch { /* notifications unavailable */ }
    });
  }, [user.id, user.access]);

  if (alerts.length === 0) return null;
  return createPortal(
    <div className="pointer-events-none fixed right-3 top-3 z-[95] flex w-[min(360px,calc(100vw-1.5rem))] flex-col gap-2 sm:right-5 sm:top-5">
      {alerts.map((a) => (
        <div key={a.key} className="pointer-events-auto animate-slide-up overflow-hidden rounded-2xl bg-[#13261c] text-white shadow-2xl ring-1 ring-white/10">
          <div className="flex items-start gap-3 px-4 pt-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#c9a96e]/20 text-[#e9dcc0]">
              <Eye className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{a.buyer} is looking at Plot {a.plotNo}</div>
              <div className="text-[12.5px] text-white/65">
                {a.views > 1 ? `Opened for the ${nth(a.views)} time` : 'Opened their quote just now'} — a good moment to call.
              </div>
            </div>
            <button onClick={() => setAlerts((p) => p.filter((x) => x.key !== a.key))} aria-label="Dismiss" className="-mr-1 -mt-1 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          {a.phone && (
            <div className="mt-3 flex gap-2 px-4 pb-4">
              <a href={`tel:${a.phone}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-[13px] font-semibold text-[#13261c]">
                <Phone className="h-4 w-4" /> Call now
              </a>
              <a href={waLink(a.phone)} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2 text-[13px] font-semibold">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>
          )}
          {!a.phone && <div className="h-4" />}
        </div>
      ))}
    </div>,
    document.body,
  );
}

/** Every quote sent, who opened it, how often and when. */
export function SentQuotesPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<QuoteActivity[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const load = () => void fetchQuoteActivity(200).then(setRows);
    load();
    // Keep counts live while the panel is open.
    return onQuoteOpened(load);
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || [r.buyer_name, r.sender_name, findPlot(r.plot_id)?.plotNo, r.buyer_phone].some((v) => v?.toLowerCase().includes(s)));
  }, [rows, q]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="animate-scale-in flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-gray-900">Sent quotes</h2>
            <p className="text-[12.5px] text-gray-500">Who opened their invitation, how often and when. Call while it's fresh.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search buyer, plot or advisor" className="w-full bg-transparent text-sm outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rows === null ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
          ) : shown.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-gray-400">
              {rows.length === 0 ? 'No tracked quotes yet. Use “Send to buyer” on any plot — each one shows up here.' : 'No quotes match.'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {shown.map((r) => {
                const plot = findPlot(r.plot_id);
                const hot = r.views >= 3 || (r.last_viewed_at && Date.now() - new Date(r.last_viewed_at).getTime() < 86400000);
                return (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-center ${r.views === 0 ? 'bg-gray-100 text-gray-400' : hot ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-700'}`}>
                      <div>
                        <div className="text-[15px] font-bold leading-none">{r.views}</div>
                        <div className="text-[9px] font-semibold uppercase">opens</div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-gray-900">
                        {r.buyer_name || 'Unnamed buyer'} <span className="font-normal text-gray-400">· Plot {plot?.plotNo ?? r.plot_id}</span>
                      </div>
                      <div className="truncate text-[12px] text-gray-500">
                        {r.last_viewed_at ? `Last opened ${timeAgo(r.last_viewed_at)}` : 'Not opened yet'} · sent {timeAgo(r.created_at)}{r.sender_name ? ` by ${r.sender_name}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {r.buyer_phone && (
                        <>
                          <a href={`tel:${r.buyer_phone}`} title="Call" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"><Phone className="h-4 w-4" /></a>
                          <a href={waLink(r.buyer_phone)} target="_blank" rel="noreferrer" title="WhatsApp" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"><MessageCircle className="h-4 w-4" /></a>
                        </>
                      )}
                      <a href={quoteUrl(r.id)} target="_blank" rel="noreferrer" title="Open the quote (doesn't count as a view)" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"><ExternalLink className="h-4 w-4" /></a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
