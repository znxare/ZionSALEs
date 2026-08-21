import { useEffect, useRef, useState } from 'react';
import { Search, Plus, Bell, MapPin, Clock, X } from 'lucide-react';
import type { SiteVisit } from '@/lib/supabase';
import { fetchAllSiteVisits, isToday, formatDate, formatTime, relativeDay } from '@/lib/crm';

interface Props {
  onSearch: () => void;
  onAdd: () => void;
}

export default function TopBar({ onSearch, onAdd }: Props) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAllSiteVisits().then(setVisits).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [notifOpen]);

  const upcomingVisits = visits
    .filter((v) => {
      const d = new Date(v.scheduled_at);
      const now = new Date();
      return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 8);

  const todayVisits = upcomingVisits.filter((v) => isToday(v.scheduled_at));
  const notifCount = todayVisits.length;

  return (
    <header className="sticky top-0 z-30 glass border-b border-black/5">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        <a href="#/" className="flex items-center gap-2.5">
          <img
            src="https://zionhills.in/wp-content/uploads/2025/05/logo.svg"
            alt="Zion Hills"
            className="h-8 w-auto sm:h-9"
          />
          <div className="leading-tight">
            <div className="font-display text-[15px] font-bold tracking-tight text-[#F05A22]">
              CRM
            </div>
            <div className="hidden text-[11px] font-medium text-gray-400 sm:block">Sales Cockpit</div>
          </div>
        </a>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onSearch}
            className="flex items-center gap-2 rounded-full border border-black/5 bg-white/70 px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-white hover:text-gray-700 card-shadow sm:px-4"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search leads</span>
            <kbd className="hidden rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400 sm:inline">⌘K</kbd>
          </button>

          {/* Notification center */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative grid h-9 w-9 place-items-center rounded-full border border-orange-200/40 bg-orange-50/40 text-orange-600 transition hover:bg-orange-50 card-shadow"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {notifCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                  {notifCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1.5rem)] animate-scale-in overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-900">Notifications</span>
                  </div>
                  <button onClick={() => setNotifOpen(false)} className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {upcomingVisits.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <MapPin className="mx-auto h-8 w-8 text-gray-200" />
                      <p className="mt-2 text-[13px] font-medium text-gray-400">No upcoming site visits</p>
                      <p className="mt-0.5 text-[11px] text-gray-300">Scheduled visits will appear here</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {upcomingVisits.map((v) => {
                        const today = isToday(v.scheduled_at);
                        return (
                          <div key={v.id} className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-gray-50">
                            <div className={'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ' + (today ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600')}>
                              <MapPin className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-gray-700">{v.property || 'Site visit scheduled'}</p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                                <Clock className="h-3 w-3" />
                                <span className={today ? 'font-semibold text-orange-600' : ''}>
                                  {today ? 'Today, ' + formatTime(v.scheduled_at) : relativeDay(v.scheduled_at) + ', ' + formatDate(v.scheduled_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="flex items-center gap-2 rounded-full border border-gray-200/60 surface-warm py-1 pl-1 pr-2 card-shadow sm:pr-3">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-[11px] font-bold text-white shadow-sm">
              AK
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-[12px] font-semibold text-gray-700">Amit Kumar</div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Asst. Sales Manager
              </div>
            </div>
          </div>

          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-full orange-gradient px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 sm:px-4"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Lead</span>
          </button>
        </div>
      </div>
    </header>
  );
}
