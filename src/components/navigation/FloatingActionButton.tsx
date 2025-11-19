import { Pencil } from 'lucide-react';

interface FloatingActionButtonProps {
  onClick: () => void;
  hidden?: boolean;
}

export const FloatingActionButton = ({ onClick, hidden = false }: FloatingActionButtonProps) => {
  if (hidden) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="fixed bottom-[72px] right-4 md:bottom-20 md:right-8 z-[80] hover:scale-110 active:scale-95 transition-transform duration-200"
      aria-label="Create post"
    >
      <Pencil className="w-8 h-8 md:w-9 md:h-9 text-foreground" strokeWidth={2} />
    </button>
  );
};
