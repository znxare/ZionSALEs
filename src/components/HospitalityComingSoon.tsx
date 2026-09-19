import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
}

// Placeholder screen for Hospitality nav items until the hospitality_leads
// data model exists — shows an honest empty state instead of fake numbers.
export default function HospitalityComingSoon({ icon: Icon, title, description }: Props) {
  return (
    <div className="animate-fade-in">
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-rose-200 bg-rose-50/30 px-6 py-16 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-600 shadow-sm">
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold tracking-tight text-gray-900">{title}</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">{description}</p>
        <span className="mt-4 inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-700">
          Coming soon
        </span>
      </div>
    </div>
  );
}
