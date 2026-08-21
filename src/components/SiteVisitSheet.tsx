import { useState } from 'react';
import { X, MapPin, Check } from 'lucide-react';
import { toLocalInputValue, daysFromNow } from '@/lib/crm';

interface Props {
  onClose: () => void;
  onPick: (when: string) => void;
}

export default function SiteVisitSheet({ onClose, onPick }: Props) {
  const [custom, setCustom] = useState('');

  const options = [
    { label: 'Today', when: daysFromNow(0) },
    { label: 'Tomorrow', when: daysFromNow(1) },
    { label: 'In 3 days', when: daysFromNow(3) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md animate-slide-up overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:animate-scale-in sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">Schedule site visit</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="h-4 w-4 text-violet-600" />
            When is the site visit?
          </div>
          <div className="grid gap-2.5">
            {options.map((o) => (
              <button
                key={o.label}
                onClick={() => onPick(o.when)}
                className="flex items-center justify-between rounded-2xl border border-gray-150 bg-white px-4 py-3.5 text-left transition hover:border-violet-200 hover:bg-violet-50/40"
              >
                <span className="font-semibold text-gray-800">{o.label}</span>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-violet-500 text-white">
                  <Check className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">Pick a date & time</label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-violet-300"
              />
              <button
                onClick={() => custom && onPick(new Date(custom).toISOString())}
                disabled={!custom}
                className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
