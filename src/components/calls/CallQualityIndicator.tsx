import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallQualityIndicatorProps {
  connectionState: RTCPeerConnectionState;
  stats?: {
    latency: number;
    packetLoss: number;
    bandwidth: number;
  };
}

export const CallQualityIndicator = ({ connectionState, stats }: CallQualityIndicatorProps) => {
  const [quality, setQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');

  useEffect(() => {
    if (!stats) return;

    // Determine quality based on stats
    const { latency, packetLoss } = stats;
    
    if (latency < 100 && packetLoss < 1) {
      setQuality('excellent');
    } else if (latency < 200 && packetLoss < 3) {
      setQuality('good');
    } else if (latency < 300 && packetLoss < 5) {
      setQuality('fair');
    } else {
      setQuality('poor');
    }
  }, [stats]);

  const getQualityColor = () => {
    switch (quality) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-blue-500';
      case 'fair':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getQualityBars = () => {
    switch (quality) {
      case 'excellent':
        return 4;
      case 'good':
        return 3;
      case 'fair':
        return 2;
      case 'poor':
        return 1;
      default:
        return 0;
    }
  };

  const getConnectionIcon = () => {
    if (connectionState === 'connected') {
      return <Wifi className={cn('w-4 h-4', getQualityColor())} />;
    }
    return <WifiOff className="w-4 h-4 text-red-500" />;
  };

  const bars = getQualityBars();

  return (
    <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
      {getConnectionIcon()}
      
      {/* Signal bars */}
      <div className="flex items-end gap-0.5 h-4">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={cn(
              'w-1 rounded-sm transition-all duration-300',
              bar <= bars ? getQualityColor() : 'bg-gray-600',
            )}
            style={{
              height: `${bar * 25}%`,
              backgroundColor: bar <= bars ? undefined : undefined,
            }}
          />
        ))}
      </div>

      {/* Stats tooltip on hover */}
      {stats && (
        <div className="text-xs text-white font-medium">
          {connectionState === 'connected' ? (
            <span className="capitalize">{quality}</span>
          ) : (
            <span>Connecting...</span>
          )}
        </div>
      )}
    </div>
  );
};
