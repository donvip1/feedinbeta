import { useEffect, useCallback, useRef } from 'react';
import { Camera, Image, Type, Radio, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NativeCreationSheetProps {
  open: boolean;
  onClose: () => void;
  onCameraSelect: () => void;
  onGallerySelect: () => void;
  onStorySelect: () => void;
  onTextSelect: () => void;
}

const options = [
  {
    id: 'camera',
    label: 'Camera',
    description: 'Take a photo or video',
    icon: Camera,
    gradient: 'from-blue-500 to-cyan-400',
    action: 'onCameraSelect',
  },
  {
    id: 'gallery',
    label: 'Gallery',
    description: 'Choose from photos',
    icon: Image,
    gradient: 'from-purple-500 to-pink-400',
    action: 'onGallerySelect',
  },
  {
    id: 'story',
    label: 'Story',
    description: 'Share for 24 hours',
    icon: Radio,
    gradient: 'from-pink-500 to-rose-400',
    action: 'onStorySelect',
  },
  {
    id: 'text',
    label: 'Text',
    description: 'Write a post',
    icon: Type,
    gradient: 'from-orange-500 to-amber-400',
    action: 'onTextSelect',
  },
];

export default function NativeCreationSheet({
  open,
  onClose,
  onCameraSelect,
  onGallerySelect,
  onStorySelect,
  onTextSelect,
}: NativeCreationSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  const triggerHaptic = useCallback(async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}
  }, []);

  const handleOptionClick = useCallback((action: string) => {
    triggerHaptic();
    const actions: Record<string, () => void> = {
      onCameraSelect,
      onGallerySelect,
      onStorySelect,
      onTextSelect,
    };
    actions[action]?.();
  }, [onCameraSelect, onGallerySelect, onStorySelect, onTextSelect, triggerHaptic]);

  // Handle drag to dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = currentYRef.current - startYRef.current;
    if (diff > 100) {
      onClose();
    }
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
    startYRef.current = 0;
    currentYRef.current = 0;
  }, [onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl',
          'transform transition-transform duration-300 ease-out',
          'safe-area-bottom',
          open ? 'animate-slide-up' : 'translate-y-full'
        )}
        style={{ willChange: 'transform' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted/50 active:scale-95 transition-transform"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Title */}
        <div className="px-6 pb-4">
          <h2 className="text-xl font-bold text-foreground">Create</h2>
        </div>

        {/* Options */}
        <div className="px-4 pb-8 space-y-2">
          {options.map((option, index) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.action)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-2xl',
                  'bg-muted/30 hover:bg-muted/50 active:scale-[0.98]',
                  'transition-all duration-150 ease-out',
                  'touch-manipulation'
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Icon with gradient background */}
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center',
                  'bg-gradient-to-br shadow-lg',
                  option.gradient
                )}>
                  <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
                </div>

                {/* Text */}
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-foreground">
                    {option.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>

                {/* Arrow */}
                <div className="text-muted-foreground/50">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>

        {/* Cancel button */}
        <div className="px-4 pb-6">
          <button
            onClick={onClose}
            className={cn(
              'w-full py-4 rounded-2xl text-center',
              'text-muted-foreground font-medium',
              'hover:bg-muted/30 active:scale-[0.98]',
              'transition-all duration-150'
            )}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
