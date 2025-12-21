import { Wifi, WifiOff, Signal, SignalLow, SignalMedium, SignalHigh } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NetworkQuality {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  bitrate: number;
  packetLoss: number;
  latency: number;
}

interface NetworkQualityIndicatorProps {
  quality: NetworkQuality | null;
  className?: string;
  showDetails?: boolean;
}

export const NetworkQualityIndicator = ({ 
  quality, 
  className,
  showDetails = false 
}: NetworkQualityIndicatorProps) => {
  if (!quality) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        <WifiOff className="w-4 h-4" />
      </div>
    );
  }

  const getQualityColor = () => {
    switch (quality.quality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-green-500';
      case 'fair': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
    }
  };

  const getQualityIcon = () => {
    switch (quality.quality) {
      case 'excellent': 
        return <SignalHigh className="w-4 h-4" />;
      case 'good': 
        return <SignalMedium className="w-4 h-4" />;
      case 'fair': 
        return <SignalLow className="w-4 h-4" />;
      case 'poor': 
        return <Signal className="w-4 h-4" />;
    }
  };

  const getBars = () => {
    const bars = [];
    const totalBars = 4;
    let activeBars = 0;
    
    switch (quality.quality) {
      case 'excellent': activeBars = 4; break;
      case 'good': activeBars = 3; break;
      case 'fair': activeBars = 2; break;
      case 'poor': activeBars = 1; break;
    }
    
    for (let i = 0; i < totalBars; i++) {
      const isActive = i < activeBars;
      bars.push(
        <div
          key={i}
          className={cn(
            "w-1 rounded-full transition-all",
            isActive ? getQualityColor().replace('text-', 'bg-') : 'bg-white/20',
          )}
          style={{ height: `${6 + i * 3}px` }}
        />
      );
    }
    return bars;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-end gap-0.5">
        {getBars()}
      </div>
      
      {showDetails && (
        <div className="text-xs text-white/70 flex items-center gap-2">
          <span>{quality.latency}ms</span>
          <span className="text-white/30">•</span>
          <span>{quality.bitrate}kbps</span>
          {quality.packetLoss > 0 && (
            <>
              <span className="text-white/30">•</span>
              <span className={cn(quality.packetLoss > 2 ? 'text-red-400' : '')}>
                {quality.packetLoss}% loss
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
