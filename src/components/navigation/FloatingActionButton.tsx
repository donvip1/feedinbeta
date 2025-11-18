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
      className="fixed bottom-[72px] right-4 md:bottom-20 md:right-8 z-[80] w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform duration-200"
      aria-label="Create post"
    >
      <PenSquare className="w-6 h-6 md:w-7 md:h-7 text-white" />
    </button>
  );
};
