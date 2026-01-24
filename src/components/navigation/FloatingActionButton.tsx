import { useCallback, useState } from 'react';
import editIcon from '@/assets/edit-icon.png';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  onClick: () => void;
  hidden?: boolean;
}

export const FloatingActionButton = ({ onClick, hidden = false }: FloatingActionButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);

  const triggerHaptic = useCallback(async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else if (navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch {}
  }, []);

  const handleClick = useCallback(() => {
    triggerHaptic();
    onClick();
  }, [onClick, triggerHaptic]);

  if (hidden) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      className={cn(
      'fixed bottom-2 md:bottom-4 z-[80]',
      // Positioned over the profile avatar (last nav item on the right)
      'right-3 md:right-auto md:left-1/2 md:ml-[calc(min(256px,50vw-2rem)-28px)]',
        'flex items-center justify-center',
        'transition-all duration-200 ease-out',
        'touch-manipulation',
        isPressed ? 'scale-90' : 'hover:scale-110 active:scale-95',
        'drop-shadow-lg'
      )}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      aria-label="Create post"
    >
      {/* Pulse ring effect */}
      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
      
      {/* Icon */}
        <img 
          src={editIcon} 
          alt="Create post" 
          className={cn(
            'w-9 h-9 md:w-10 md:h-10 object-contain relative z-10',
            'transition-transform duration-150'
          )} 
        />
    </button>
  );
};
