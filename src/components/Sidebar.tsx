import { useState } from 'react';
import { LayoutDashboard, Users, MapPin, Megaphone, Landmark, CalendarCheck, Snowflake, Upload, Menu, X } from 'lucide-react';
import ConnectionStatus from '@/components/ConnectionStatus';

interface Props {
  current: 'dashboard' | 'leads' | 'sitevisits' | 'campaigns' | 'leadbank' | 'import' | 'planner' | 'reactivation';
  onNavigate: (route: 'dashboard' | 'leads' | 'sitevisits' | 'campaigns' | 'leadbank' | 'import' | 'planner' | 'reactivation') => void;
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
];

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
            return (
              <button
                key={it.id}
                onClick={() => onNavigate(it.id)}
                className={'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ' + (active ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200/60 brand-accent-bar' : 'text-gray-600 hover:bg-gray-100/80')}
              >
                <it.icon className={'h-4.5 w-4.5 ' + (active ? 'text-orange-600' : '')} />
                {it.label}
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
                return (
                  <button
                    key={it.id}
                    onClick={() => go(it.id)}
                    className={'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ' + (active ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200/60 brand-accent-bar' : 'text-gray-600 hover:bg-gray-100/80')}
                  >
                    <it.icon className={'h-4.5 w-4.5 ' + (active ? 'text-orange-600' : '')} />
                    {it.label}
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
