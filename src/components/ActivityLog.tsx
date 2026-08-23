import { useEffect, useState } from 'react';
import { History, Loader2, User } from 'lucide-react';
import { fetchRecentActivities, formatDateTime, type ActivityFeedEntry } from '@/lib/crm';

interface Props {
  onOpenLead: (id: string) => void;
}

function typeTint(type: string): string {
  if (type === 'Called' || type === 'No Answer') return 'bg-emerald-50 text-emerald-600';
  if (type === 'WhatsApp Sent') return 'bg-green-50 text-green-600';
  if (type === 'Site Visit Scheduled' || type === 'Site Visit Completed') return 'bg-violet-50 text-violet-600';
  if (type === 'Follow-up Scheduled') return 'bg-orange-50 text-orange-600';
  if (type === 'Status Changed') return 'bg-sky-50 text-sky-600';
  if (type === 'Sale Completed' || type === 'Booking') return 'bg-amber-50 text-amber-600';
  if (type === 'Not Interested') return 'bg-gray-100 text-gray-500';
  return 'bg-gray-100 text-gray-500';
}

export default function ActivityLog({ onOpenLead }: Props) {
  const [entries, setEntries] = useState<ActivityFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentActivities(150)
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load activity'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="font-display text-lg font-bold tracking-tight text-gray-900">Activity Log</h1>
        <p className="text-[13px] text-gray-400">Everything the team has done, most recent first.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <History className="mx-auto h-8 w-8 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-500">No activity yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white card-shadow">
          {entries.map((e, i) => (
            <button
              key={e.id}
              onClick={() => onOpenLead(e.lead_id)}
              className={'flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-gray-50/60 ' + (i !== 0 ? 'border-t border-gray-100' : '')}
            >
              <span className={'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ' + typeTint(e.type)}>
                {e.type.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {e.type}
                    {e.lead_name && <span className="font-normal text-gray-400"> · {e.lead_name}</span>}
                  </p>
                  <span className="shrink-0 text-[11px] text-gray-400">{formatDateTime(e.created_at)}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-gray-500">{e.summary}</p>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                  <User className="h-3 w-3" />
                  {e.actor_name ?? 'Unknown user'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
