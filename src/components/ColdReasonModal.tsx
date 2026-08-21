import { useState, useEffect } from 'react';
import { X, Snowflake } from 'lucide-react';
import type { Lead, ColdReason } from '@/lib/crm';
import { COLD_REASONS, coldReasonDays, daysFromNow, toLocalInputValue, formatDate } from '@/lib/crm';

interface Props {
  lead: Lead;
  onClose: () => void;
  onConfirm: (reason: ColdReason, nextReactivationAt: string) => void;
}

export default function ColdReasonModal({ lead, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState<ColdReason | ''>('');
  const [note, setNote] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const days = reason ? coldReasonDays(reason) : null;
  const defaultDate = days ? toLocalInputValue(daysFromNow(days)).slice(0, 10) : '';
  const effectiveDate = customDate || defaultDate;

  async function confirm() {
    if (!reason) return;
    setSaving(true);
    try {
      const when = new Date(`${effectiveDate}T10:00`).toISOString();
      onConfirm(reason as ColdReason, when);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:animate-scale-in sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600">
              <Snowflake className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">Why did this lead become Cold?</h2>
              <p className="text-[12px] text-gray-400">{lead.name} — this helps plan reactivation</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Reason (required)</label>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {COLD_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-medium transition ${reason === r ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                >
                  <span>{r}</span>
                  {coldReasonDays(r) && (
                    <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${reason === r ? 'bg-sky-200 text-sky-800' : 'bg-gray-100 text-gray-400'}`}>
                      {coldReasonDays(r)}d
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {reason === 'Other' && (
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Optional note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Add a note about why this lead is cold…"
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sky-300"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Next reactivation date</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sky-300"
            />
            {days && !customDate && (
              <p className="mt-1 text-[11px] text-gray-400">Auto-scheduled {days} days from now ({formatDate(daysFromNow(days))}). You can change it.</p>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-gray-100 bg-white px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-full bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!reason || saving}
            className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full bg-sky-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-50"
          >
            <Snowflake className="h-4 w-4" /> {saving ? 'Saving…' : 'Mark Cold & Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
