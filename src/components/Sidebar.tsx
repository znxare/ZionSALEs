import { useState } from 'react';
import { LayoutDashboard, Users, MapPin, Megaphone, Landmark, CalendarCheck, Snowflake, Upload, Menu, X, History, Flag } from 'lucide-react';
import ConnectionStatus from '@/components/ConnectionStatus';

interface Props {
  current: 'dashboard' | 'leads' | 'sitevisits' | 'campaigns' | 'leadbank' | 'import' | 'planner' | 'reactivation' | 'battlecard' | 'activitylog';
  onNavigate: (route: 'dashboard' | 'leads' | 'sitevisits' | 'campaigns' | 'leadbank' | 'import' | 'planner' | 'reactivation' | 'battlecard' | 'activitylog') => void;
}

const items = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads' as const, label: 'All Leads', icon: Users },
  { id: 'leadbank' as const, label: 'Lead Bank', icon: Landmark },
  { id: 'import' as const, label: 'Lead Import', icon: Upload },
  { id: 'sitevisits' as const, label: 'Site Visits', icon: MapPin },
  { id: 'planner' as const, label: 'Day Planner', icon: CalendarCheck },
  { id: 'campaigns' as const, label: 'Campaigns', icon: Megaphone },
  { id: 'reactivation' as const, label: 'Reactivation', icon: Snowflake },
  { id: 'battlecard' as const, label: 'Battle Card', icon: Flag, badge: 'DEV' },
  { id: 'activitylog' as const, label: 'Activity Log', icon: History },
];

// Each tab gets its own accent, echoing the semantic colors used on the Dashboard's KPI cards.
const TAB_COLORS: Record<Props['current'], { bg: string; text: string; ring: string; icon: string; border: string }> = {
  dashboard: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200/60', icon: 'text-orange-600', border: 'border-orange-500' },
  leads: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200/60', icon: 'text-slate-600', border: 'border-slate-400' },
  leadbank: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200/60', icon: 'text-violet-600', border: 'border-violet-500' },
  import: { bg: 'bg-teal-50', text: 'text-teal-700', ring: 'ring-teal-200/60', icon: 'text-teal-600', border: 'border-teal-500' },
  sitevisits: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200/60', icon: 'text-blue-600', border: 'border-blue-500' },
  planner: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200/60', icon: 'text-amber-600', border: 'border-amber-500' },
  campaigns: { bg: 'bg-pink-50', text: 'text-pink-700', ring: 'ring-pink-200/60', icon: 'text-pink-600', border: 'border-pink-500' },
  reactivation: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200/60', icon: 'text-sky-600', border: 'border-sky-500' },
  battlecard: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200/60', icon: 'text-emerald-600', border: 'border-emerald-500' },
  activitylog: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200/60', icon: 'text-indigo-600', border: 'border-indigo-500' },
};

function ZionOrmLink() {
  return (
    <a
      href="https://ormcrm.com"
      target="_blank"
      rel="noreferrer"
      className="mt-4 flex items-center justify-center gap-1.5 px-3 text-[11px] text-gray-400 transition hover:text-gray-600"
    >
      <span>Zion Hills</span>
      <span className="text-gray-300">×</span>
      <svg width="14" height="14" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="shrink-0">
        <rect width="26" height="26" rx="7" fill="#BC5A32" />
        <path d="M10,4 L16,4 L17,7 L18,15 L13,22 L8,15 L9,7 Z" fill="#FAF8F4" />
      </svg>
      <span className="font-semibold text-gray-500">ORM</span>
    </a>
  );
}

export default function Sidebar({ current, onNavigate }: Props) {
  const [open, setOpen] = useState(false);

  function go(id: Props['current']) {
    onNavigate(id);
    setOpen(false);
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-56 shrink-0 overflow-y-auto border-r border-gray-200/60 bg-warm-surface px-3 py-5 lg:block">
        <nav className="space-y-1">
          {items.map((it) => {
            const active = current === it.id;
            const c = TAB_COLORS[it.id];
            return (
              <button
                key={it.id}
                onClick={() => onNavigate(it.id)}
                className={'flex w-full items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5 text-sm font-medium transition ' + (active ? c.bg + ' ' + c.text + ' ring-1 ' + c.ring + ' ' + c.border : 'border-transparent text-gray-600 hover:bg-gray-100/80')}
              >
                <it.icon className={'h-4.5 w-4.5 ' + (active ? c.icon : '')} />
                {it.label}
                {'badge' in it && it.badge && (
                  <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-700">{it.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <ConnectionStatus />
        <ZionOrmLink />
      </aside>

      {/* Mobile menu trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed bottom-4 right-4 z-30 grid h-12 w-12 place-items-center rounded-full brand-gradient text-white shadow-lg lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile side drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-warm-surface px-3 py-5 shadow-2xl">
            <div className="flex items-center justify-between px-2 pb-3">
              <span className="text-sm font-semibold text-gray-700">Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-1">
              {items.map((it) => {
                const active = current === it.id;
                const c = TAB_COLORS[it.id];
                return (
                  <button
                    key={it.id}
                    onClick={() => go(it.id)}
                    className={'flex w-full items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5 text-sm font-medium transition ' + (active ? c.bg + ' ' + c.text + ' ring-1 ' + c.ring + ' ' + c.border : 'border-transparent text-gray-600 hover:bg-gray-100/80')}
                  >
                    <it.icon className={'h-4.5 w-4.5 ' + (active ? c.icon : '')} />
                    {it.label}
                    {'badge' in it && it.badge && (
                      <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-700">{it.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>

            <ConnectionStatus />
            <ZionOrmLink />
          </aside>
        </div>
      )}
    </>
  );
}
