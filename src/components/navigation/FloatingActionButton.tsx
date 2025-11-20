import editIcon from '@/assets/edit-icon.png';

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
      className="fixed bottom-[72px] right-4 md:bottom-20 md:right-8 z-[80] hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center"
      aria-label="Create post"
    >
      <img src={editIcon} alt="Create post" className="w-12 h-12 md:w-14 md:h-14 object-contain" />
    </button>
  );
};
