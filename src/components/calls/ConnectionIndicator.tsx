import React from 'react';
import { Wifi, WifiOff, Signal, SignalLow, SignalMedium } from 'lucide-react';

interface ConnectionIndicatorProps {
  connectionState: RTCPeerConnectionState;
  latency: number | null;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({ connectionState, latency }) => {
  const getIndicator = () => {
    switch (connectionState) {
      case 'connected':
        if (latency === null) {
          return <Wifi className="w-5 h-5 text-green-500" />;
        }
        if (latency < 150) {
          return <Signal className="w-5 h-5 text-green-500" />;
        }
        if (latency < 300) {
          return <SignalMedium className="w-5 h-5 text-yellow-500" />;
        }
        return <SignalLow className="w-5 h-5 text-red-500" />;
      case 'connecting':
        return <p className="text-xs text-muted-foreground">Connecting...</p>;
      case 'disconnected':
      case 'failed':
      case 'closed':
        return <WifiOff className="w-5 h-5 text-red-500" />;
      default:
        return <p className="text-xs text-muted-foreground">... </p>;
    }
  };

  const getTooltip = () => {
    switch (connectionState) {
      case 'connected':
        return latency !== null ? `Excellent connection (Latency: ${latency.toFixed(0)}ms)` : 'Connected';
      case 'connecting':
        return 'Attempting to connect...';
      case 'disconnected':
      case 'failed':
      case 'closed':
        return 'Connection lost. Please check your network.';
      default:
        return 'Connection status is unknown.';
    }
  };

  return (
    <div className="flex items-center gap-2" title={getTooltip()}>
      {getIndicator()}
    </div>
  );
};
