import { PenSquare } from 'lucide-react';

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
      className="fixed bottom-[72px] right-4 md:bottom-20 md:right-8 z-[80] bg-primary/10 p-2 rounded-lg hover:bg-primary/20 hover:scale-110 active:scale-95 transition-all duration-200 border border-primary/20"
      aria-label="Create post"
    >
      <PenSquare className="w-7 h-7 md:w-8 md:h-8 text-primary" strokeWidth={2} />
    </button>
  );
};
