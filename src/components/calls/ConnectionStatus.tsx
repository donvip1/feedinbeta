import { Loader2, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Connection status types for call UI - compatible with LiveKit call manager
export type ConnectionStatusType = 
  | 'idle'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'
  | 'ended'
  | 'initializing' 
  | 'getting_media' 
  | 'signaling' 
  | 'negotiating' 
  | 'ice_checking' 
  | 'creating-session'
  | 'publishing'
  | 'subscribing'
  | 'getting-media'
  | 'waiting_for_peer';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  message: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export const ConnectionStatus = ({ 
  status, 
  message, 
  onRetry, 
  showRetry = false 
}: ConnectionStatusProps) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'idle':
      case 'ringing':
      case 'connecting':
      case 'initializing':
      case 'getting_media':
      case 'signaling':
      case 'negotiating':
      case 'ice_checking':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'connected':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'reconnecting':
        return <RefreshCw className="w-5 h-5 animate-spin text-yellow-400" />;
      case 'failed':
      case 'ended':
      case 'disconnected':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Wifi className="w-5 h-5" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'reconnecting':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'failed':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  const getProgressSteps = () => {
    const steps = [
      { key: 'initializing', label: 'Init' },
      { key: 'getting_media', label: 'Media' },
      { key: 'signaling', label: 'Signal' },
      { key: 'negotiating', label: 'Negotiate' },
      { key: 'ice_checking', label: 'Connect' },
      { key: 'connected', label: 'Ready' },
    ];

    const currentIndex = steps.findIndex(s => s.key === status);
    
    return steps.map((step, index) => ({
      ...step,
      completed: index < currentIndex,
      active: index === currentIndex,
    }));
  };

  if (status === 'connected') {
    return null; // Don't show status when connected
  }

  return (
    <div className={cn(
      "rounded-xl border p-4 backdrop-blur-sm",
      getStatusColor()
    )}>
      <div className="flex items-center gap-3 mb-3">
        {getStatusIcon()}
        <span className="text-sm font-medium">{message}</span>
      </div>

      {/* Progress Steps */}
      {status !== 'failed' && status !== 'reconnecting' && (
        <div className="flex items-center justify-between gap-1 mb-2">
          {getProgressSteps().map((step, index) => (
            <div key={step.key} className="flex-1">
              <div 
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  step.completed ? "bg-green-400" :
                  step.active ? "bg-blue-400 animate-pulse" :
                  "bg-white/20"
                )}
              />
              <p className={cn(
                "text-[10px] mt-1 text-center transition-colors",
                step.completed ? "text-green-400" :
                step.active ? "text-blue-400" :
                "text-white/40"
              )}>
                {step.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Retry Button */}
      {showRetry && status === 'failed' && onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="w-full mt-3 border-red-500/50 text-red-400 hover:bg-red-500/20"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Connection
        </Button>
      )}

      {/* Reconnecting indicator */}
      {status === 'reconnecting' && (
        <p className="text-xs text-yellow-400/70 mt-2">
          Attempting to restore connection...
        </p>
      )}
    </div>
  );
};
