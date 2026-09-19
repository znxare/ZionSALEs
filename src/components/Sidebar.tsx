import { useState } from 'react';
import {
  LayoutDashboard, Users, MapPin, Megaphone, Landmark, CalendarCheck, Snowflake, Upload,
  Menu, X, History, Flag, LayoutGrid, CalendarRange,
} from 'lucide-react';
import ConnectionStatus from '@/components/ConnectionStatus';

export type NavId =
  | 'dashboard' | 'leads' | 'sitevisits' | 'campaigns' | 'leadbank' | 'import' | 'planner'
  | 'reactivation' | 'battlecard' | 'activitylog' | 'inventory'
  | 'hospitality-leads' | 'hospitality-leadbank' | 'hospitality-booking';

interface Props {
  current: NavId;
  onNavigate: (route: NavId) => void;
}

type LeafItem = { id: NavId; label: string; icon: typeof LayoutDashboard; badge?: string };
type NavEntry = { kind: 'single'; item: LeafItem } | { kind: 'group'; label: string; children: LeafItem[] } | { kind: 'divider' };

const NAV: NavEntry[] = [
  { kind: 'single', item: { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard } },
  {
    kind: 'group',
    label: 'Real Estate',
    children: [
      { id: 'leads', label: 'All Leads', icon: Users },
      { id: 'leadbank', label: 'Lead Bank', icon: Landmark },
      { id: 'sitevisits', label: 'Site Visit', icon: MapPin },
      { id: 'inventory', label: 'Live Inventory Board', icon: LayoutGrid },
    ],
  },
  {
    kind: 'group',
    label: 'Hospitality',
    children: [
      { id: 'hospitality-leads', label: 'All Leads', icon: Users },
      { id: 'hospitality-leadbank', label: 'Lead Bank', icon: Landmark },
      { id: 'hospitality-booking', label: 'Booking Timeline', icon: CalendarRange },
    ],
  },
  { kind: 'divider' },
  { kind: 'single', item: { id: 'import', label: 'Lead Import', icon: Upload } },
  { kind: 'single', item: { id: 'planner', label: 'Day Planner', icon: CalendarCheck } },
  { kind: 'single', item: { id: 'campaigns', label: 'Campaigns', icon: Megaphone } },
  { kind: 'single', item: { id: 'reactivation', label: 'Reactivation', icon: Snowflake } },
  { kind: 'single', item: { id: 'battlecard', label: 'Battle Card', icon: Flag, badge: 'DEV' } },
  { kind: 'single', item: { id: 'activitylog', label: 'Activity Log', icon: History } },
];

// Each item gets its own accent, echoing the semantic colors used on the Dashboard's KPI cards.
// Hospitality items use a rose/fuchsia family to read as a distinct division from Real Estate.
const TAB_COLORS: Record<NavId, { bg: string; text: string; ring: string; icon: string; border: string }> = {
  dashboard: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200/60', icon: 'text-orange-600', border: 'border-orange-500' },
  leads: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200/60', icon: 'text-slate-600', border: 'border-slate-400' },
  leadbank: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200/60', icon: 'text-violet-600', border: 'border-violet-500' },
  import: { bg: 'bg-teal-50', text: 'text-teal-700', ring: 'ring-teal-200/60', icon: 'text-teal-600', border: 'border-teal-500' },
  sitevisits: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200/60', icon: 'text-blue-600', border: 'border-blue-500' },
  inventory: { bg: 'bg-lime-50', text: 'text-lime-700', ring: 'ring-lime-200/60', icon: 'text-lime-600', border: 'border-lime-500' },
  planner: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200/60', icon: 'text-amber-600', border: 'border-amber-500' },
  campaigns: { bg: 'bg-pink-50', text: 'text-pink-700', ring: 'ring-pink-200/60', icon: 'text-pink-600', border: 'border-pink-500' },
  reactivation: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200/60', icon: 'text-sky-600', border: 'border-sky-500' },
  battlecard: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200/60', icon: 'text-emerald-600', border: 'border-emerald-500' },
  activitylog: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200/60', icon: 'text-indigo-600', border: 'border-indigo-500' },
  'hospitality-leads': { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200/60', icon: 'text-rose-600', border: 'border-rose-500' },
  'hospitality-leadbank': { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', ring: 'ring-fuchsia-200/60', icon: 'text-fuchsia-600', border: 'border-fuchsia-500' },
  'hospitality-booking': { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200/60', icon: 'text-red-600', border: 'border-red-500' },
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

function NavButton({ item, current, indented, onClick }: { item: LeafItem; current: NavId; indented?: boolean; onClick: (id: NavId) => void }) {
  const active = current === item.id;
  const c = TAB_COLORS[item.id];
  return (
    <button
      onClick={() => onClick(item.id)}
      className={
        'flex w-full items-center gap-3 rounded-xl border-l-[3px] py-2.5 text-sm font-medium transition ' +
        (indented ? 'pl-6 pr-3' : 'px-3') +
        ' ' +
        (active ? c.bg + ' ' + c.text + ' ring-1 ' + c.ring + ' ' + c.border : 'border-transparent text-gray-600 hover:bg-gray-100/80')
      }
    >
      <item.icon className={'h-4.5 w-4.5 shrink-0 ' + (active ? c.icon : '')} />
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-700">{item.badge}</span>
      )}
    </button>
  );
}

function NavList({ current, onClick }: { current: NavId; onClick: (id: NavId) => void }) {
  return (
    <nav className="space-y-1">
      {NAV.map((entry, i) => {
        if (entry.kind === 'divider') {
          return (
            <div key={'divider-' + i} className="my-5 flex items-center gap-2.5 px-1" aria-hidden="true">
              <div className="h-px flex-1 bg-gray-300" />
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-300" />
              <div className="h-px flex-1 bg-gray-300" />
            </div>
          );
        }
        if (entry.kind === 'single') {
          return <NavButton key={entry.item.id} item={entry.item} current={current} onClick={onClick} />;
        }
        return (
          <div key={entry.label} className={i > 0 ? 'pt-2' : ''}>
            <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">{entry.label}</p>
            <div className="space-y-1">
              {entry.children.map((child) => (
                <NavButton key={child.id} item={child} current={current} indented onClick={onClick} />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ current, onNavigate }: Props) {
  const [open, setOpen] = useState(false);

  function go(id: NavId) {
    onNavigate(id);
    setOpen(false);
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-56 shrink-0 overflow-y-auto border-r border-gray-200/60 bg-warm-surface px-3 py-5 lg:block">
        <NavList current={current} onClick={onNavigate} />
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

            <NavList current={current} onClick={go} />

            <ConnectionStatus />
            <ZionOrmLink />
          </aside>
        </div>
      )}
    </>
  );
}
