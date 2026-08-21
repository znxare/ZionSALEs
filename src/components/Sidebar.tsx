import { LayoutDashboard, Users, MapPin, Megaphone, Landmark, CalendarCheck, Snowflake, Upload } from 'lucide-react';

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

export default function Sidebar({ current, onNavigate }: Props) {
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

        {/* Profile area */}
        <div className="mt-6 rounded-2xl border border-gray-200/60 bg-warm-surface-2 p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-[12px] font-bold text-white shadow-sm">
              AK
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-gray-700">Amit Kumar</div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Asst. Sales Mgr
              </div>
            </div>
          </div>
          <div className="mt-2.5 rounded-lg bg-white px-2.5 py-1.5 text-[10px] text-gray-400 ring-1 ring-gray-200/60">
            Profile settings — coming soon
          </div>
        </div>

        <div className="mt-4 px-3">
          <img src="https://zionhills.in/wp-content/uploads/2025/05/logo.svg" alt="Zion Hills" className="mb-2 h-8 w-auto" />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Pipeline</p>
          <p className="mt-1 text-[12px] text-gray-400">Zion Hills Golf County</p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-gray-200/60 bg-warm-surface/90 backdrop-blur lg:hidden">
        {items.map((it) => {
          const active = current === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onNavigate(it.id)}
              className={'flex flex-1 flex-col items-center gap-0.5 py-2 text-[9px] font-medium transition ' + (active ? 'text-orange-600' : 'text-gray-400')}
            >
              <it.icon className="h-[18px] w-[18px]" />
              {it.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
