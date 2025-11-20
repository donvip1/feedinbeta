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
      className="fixed bottom-[72px] right-4 md:bottom-20 md:right-8 z-[80] bg-primary w-14 h-14 md:w-16 md:h-16 rounded-full hover:bg-primary/90 hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg flex items-center justify-center"
      aria-label="Create post"
    >
      <PenSquare className="w-6 h-6 md:w-7 md:h-7 text-primary-foreground" strokeWidth={2.5} />
    </button>
  );
};
