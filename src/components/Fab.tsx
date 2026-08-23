import { Plus } from 'lucide-react';

interface Props {
  onAdd: () => void;
}

export default function Fab({ onAdd }: Props) {
  return (
    <div className="fixed bottom-20 right-4 z-30 h-14 w-14 lg:bottom-6">
      <span className="absolute inset-0 rounded-full bg-orange-400 animate-pulse-ring" aria-hidden="true" />
      <button
        onClick={onAdd}
        className="absolute inset-0 grid place-items-center rounded-full brand-gradient text-white shadow-xl transition-transform duration-300 hover:scale-105"
        aria-label="Add new lead"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
