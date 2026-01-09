import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Monitor, MonitorOff, Loader2, 
  Presentation, StopCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ScreenShareButtonProps {
  onScreenStream: (stream: MediaStream | null) => void;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ScreenShareButton({
  onScreenStream,
  className,
  disabled = false,
  size = 'md',
}: ScreenShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const startScreenShare = useCallback(async (withAudio: boolean = true) => {
    if (isSharing || disabled) return;
    
    setIsLoading(true);
    
    try {
      const constraints: DisplayMediaStreamOptions = {
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: withAudio,
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      screenStreamRef.current = stream;
      setIsSharing(true);

      // Handle user stopping screen share via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      onScreenStream(stream);
      toast.success('Screen sharing started!');
    } catch (error: any) {
      console.error('[ScreenShare] Error:', error);
      
      if (error.name === 'NotAllowedError') {
        // User cancelled - not an error
        console.log('[ScreenShare] User cancelled screen share');
      } else {
        toast.error('Failed to share screen');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSharing, disabled, onScreenStream]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      screenStreamRef.current = null;
    }
    
    setIsSharing(false);
    onScreenStream(null);
    toast.info('Screen sharing stopped');
  }, [onScreenStream]);

  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  if (isSharing) {
    return (
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={stopScreenShare}
        className={cn(
          'rounded-full bg-red-500 flex items-center justify-center shadow-lg',
          'hover:bg-red-600 transition-colors',
          sizeClasses[size],
          className
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key="stop"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
          >
            <StopCircle className={cn('text-white', iconSizes[size])} />
          </motion.div>
        </AnimatePresence>
      </motion.button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileTap={{ scale: 0.85 }}
          disabled={disabled || isLoading}
          className={cn(
            'rounded-full bg-black/40 backdrop-blur flex items-center justify-center',
            'hover:bg-black/60 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            sizeClasses[size],
            className
          )}
        >
          {isLoading ? (
            <Loader2 className={cn('text-white animate-spin', iconSizes[size])} />
          ) : (
            <Monitor className={cn('text-white', iconSizes[size])} />
          )}
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur border-white/10">
        <DropdownMenuItem 
          onClick={() => startScreenShare(true)}
          className="cursor-pointer"
        >
          <Monitor className="w-4 h-4 mr-2" />
          Share Screen with Audio
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => startScreenShare(false)}
          className="cursor-pointer"
        >
          <Presentation className="w-4 h-4 mr-2" />
          Share Screen Only
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}