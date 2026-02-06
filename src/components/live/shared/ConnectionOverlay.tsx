import { motion } from 'framer-motion';
import { Loader2, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from '@/context/UnifiedLiveContext';
import { cn } from '@/lib/utils';

interface ConnectionOverlayProps {
  status: ConnectionStatus;
  onRetry?: () => void;
  className?: string;
  /** If true, renders inline/minimal style instead of fullscreen overlay */
  inline?: boolean;
}

export const ConnectionOverlay = ({ status, onRetry, className, inline = false }: ConnectionOverlayProps) => {
  if (status === 'connected' || status === 'idle') return null;

  const getContent = () => {
    switch (status) {
      case 'connecting':
        return {
          icon: <Loader2 className={cn(inline ? "w-3 h-3" : "w-8 h-8", "animate-spin")} />,
          title: 'Connecting...',
          description: 'Setting up your stream',
          color: 'text-white/60',
          bgColor: 'bg-primary/10',
        };
      case 'reconnecting':
        return {
          icon: <RefreshCw className={cn(inline ? "w-3 h-3" : "w-8 h-8", "animate-spin")} />,
          title: 'Reconnecting...',
          description: 'Please wait a moment',
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
        };
      case 'error':
        return {
          icon: <WifiOff className={cn(inline ? "w-3 h-3" : "w-8 h-8")} />,
          title: 'Connection lost',
          description: 'Tap to retry',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          showRetry: true,
        };
      case 'ended':
        return {
          icon: <AlertCircle className={cn(inline ? "w-3 h-3" : "w-8 h-8")} />,
          title: 'Stream ended',
          description: 'The host has ended this session',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/20',
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  // Inline mode - small, subtle status below title
  if (inline) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        className={cn(
          "flex items-center justify-center gap-1.5 py-1",
          className
        )}
        onClick={content.showRetry ? onRetry : undefined}
      >
        <span className={content.color}>{content.icon}</span>
        <span className={cn("text-xs font-normal", content.color)}>
          {content.title.toLowerCase()}
        </span>
      </motion.div>
    );
  }

  // Full overlay mode (original)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "absolute inset-0 z-40 flex items-center justify-center",
        "bg-black/80 backdrop-blur-sm",
        className
      )}
      onClick={content.showRetry ? onRetry : undefined}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className={cn(
          "flex flex-col items-center gap-4 p-8 rounded-3xl",
          content.bgColor,
          content.showRetry && "cursor-pointer hover:scale-105 transition-transform"
        )}
      >
        <div className={content.color}>{content.icon}</div>
        <div className="text-center">
          <p className={cn("text-lg font-semibold", content.color)}>{content.title}</p>
          <p className="text-sm text-muted-foreground">{content.description}</p>
        </div>
      </motion.div>
    </motion.div>
  );
};
