import { Plus } from 'lucide-react';

interface Props {
  onAdd: () => void;
}

export default function Fab({ onAdd }: Props) {
  return (
    <button
      onClick={onAdd}
      className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full orange-gradient text-white shadow-xl transition-transform duration-300 hover:scale-105 lg:bottom-6"
      aria-label="Add new lead"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
