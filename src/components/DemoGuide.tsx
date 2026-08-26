import { useEffect } from 'react';
import {
  X,
  LayoutDashboard,
  Users,
  Landmark,
  Upload,
  MapPin,
  CalendarCheck,
  Megaphone,
  Snowflake,
  History,
  ArrowRight,
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

const SECTIONS = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    body: 'Your sales day at a glance — overdue follow-ups, hot leads, and today’s priorities ranked so you always know who to contact first.',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    icon: Users,
    title: 'All Leads',
    body: 'The full lead list. Filter by status or priority, and open any lead to see its complete timeline and activity history.',
    color: 'bg-slate-100 text-slate-600',
  },
  {
    icon: Landmark,
    title: 'Lead Bank',
    body: 'Raw enquiries pasted in from spreadsheets, sitting here until someone qualifies them into a real lead.',
    color: 'bg-violet-50 text-violet-600',
  },
  {
    icon: Upload,
    title: 'Lead Import',
    body: 'Bulk-import leads from an Excel or CSV export — see how ORM matches duplicates and flags conflicts automatically.',
    color: 'bg-teal-50 text-teal-600',
  },
  {
    icon: MapPin,
    title: 'Site Visits',
    body: 'Every scheduled and completed property visit, with outcomes and feedback logged in one place.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: CalendarCheck,
    title: 'Day Planner',
    body: 'A single ranked to-do list pulled from every lead’s next follow-up, so nothing slips through the cracks.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Megaphone,
    title: 'Campaigns',
    body: 'See which marketing sources and campaigns are actually converting into site visits and bookings.',
    color: 'bg-pink-50 text-pink-600',
  },
  {
    icon: Snowflake,
    title: 'Reactivation',
    body: 'Cold leads don’t just disappear — this is where the team works through them on a schedule instead of forgetting them.',
    color: 'bg-sky-50 text-sky-600',
  },
  {
    icon: History,
    title: 'Activity Log',
    body: 'A complete, searchable audit trail of every call, message, and status change across the whole team.',
    color: 'bg-indigo-50 text-indigo-600',
  },
];

export default function DemoGuide({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slide-up sm:rounded-3xl sm:animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between border-b border-gray-100 bg-white px-6 py-5">
          <div className="flex items-center gap-3">
            <svg width="34" height="34" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="shrink-0">
              <rect width="26" height="26" rx="7" fill="#BC5A32" />
              <path d="M10,4 L16,4 L17,7 L18,15 L13,22 L8,15 L9,7 Z" fill="#FAF8F4" />
            </svg>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">
                Welcome to the ORM CRM demo
              </h2>
              <p className="text-[12px] text-gray-400">A quick guide to what you're looking at</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <p className="text-[13.5px] leading-relaxed text-gray-600">
            This is a <span className="font-semibold text-gray-800">live, fully working copy of ORM CRM</span>,
            seeded with realistic — but entirely fictional — leads, site visits, and campaigns for a real-estate
            sales team. Click around freely: every screen behaves exactly like it would for a real customer.
          </p>

          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <p className="text-[12.5px] font-medium text-amber-800">
              It's read-only. You can try adding a lead, editing a status, or importing a file — the action will
              run, but nothing is actually saved, so feel free to experiment.
            </p>
          </div>

          <h3 className="mt-5 mb-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            What's in the sidebar
          </h3>
          <div className="space-y-2.5">
            {SECTIONS.map((s) => (
              <div key={s.title} className="flex items-start gap-3">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-gray-800">{s.title}</div>
                  <p className="text-[12.5px] leading-snug text-gray-500">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            A good place to start
          </h3>
          <ol className="list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-gray-600">
            <li>Start on the <span className="font-semibold">Dashboard</span> — that's what a salesperson opens every morning.</li>
            <li>Open a Hot lead from Today's Priorities to see its full activity timeline.</li>
            <li>Check the <span className="font-semibold">Day Planner</span> to see how follow-ups get turned into a ranked daily list.</li>
            <li>Look at <span className="font-semibold">Campaigns</span> to see which lead sources are actually converting.</li>
          </ol>

          <p className="mt-5 text-[12px] text-gray-400">
            Questions about running this for your own team?{' '}
            <a href="https://ormcrm.com" target="_blank" rel="noreferrer" className="font-semibold text-gray-600 underline decoration-gray-300 underline-offset-2 hover:text-gray-900">
              Visit ormcrm.com
            </a>
            .
          </p>
        </div>

        <div className="sticky bottom-0 border-t border-gray-100 bg-white px-6 py-4">
          <button
            onClick={onClose}
            className="flex w-full items-center justify-center gap-1.5 rounded-full brand-gradient py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Start exploring <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
