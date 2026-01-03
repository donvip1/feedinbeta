import { motion } from "framer-motion";
import { Wifi, WifiOff, Loader2, AlertCircle, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectionQuality = 'good' | 'fair' | 'poor' | 'unknown';

interface StreamHealthIndicatorProps {
  quality: ConnectionQuality;
  isBuffering?: boolean;
  isConnecting?: boolean;
  className?: string;
}

export const StreamHealthIndicator = ({
  quality,
  isBuffering,
  isConnecting,
  className,
}: StreamHealthIndicatorProps) => {
  if (isConnecting) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Connecting...</span>
      </div>
    );
  }

  if (isBuffering) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
        <span className="text-xs text-yellow-500">Buffering...</span>
      </div>
    );
  }

  const getQualityConfig = () => {
    switch (quality) {
      case 'good':
        return {
          icon: Radio,
          color: 'text-green-500',
          label: 'Live',
          bars: 3,
        };
      case 'fair':
        return {
          icon: Wifi,
          color: 'text-yellow-500',
          label: 'Fair',
          bars: 2,
        };
      case 'poor':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          label: 'Poor',
          bars: 1,
        };
      default:
        return {
          icon: WifiOff,
          color: 'text-muted-foreground',
          label: 'Unknown',
          bars: 0,
        };
    }
  };

  const config = getQualityConfig();
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {quality === 'good' && (
        <motion.div
          className="relative"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
        </motion.div>
      )}
      <Icon className={cn("w-4 h-4", config.color)} />
      <span className={cn("text-xs font-medium", config.color)}>
        {config.label}
      </span>
    </div>
  );
};
