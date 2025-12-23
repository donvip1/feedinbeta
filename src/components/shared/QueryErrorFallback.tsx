import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, RefreshCw, WifiOff, ServerCrash, ShieldX } from 'lucide-react';
import type { FC } from 'react';

interface QueryErrorFallbackProps {
  error: Error | null;
  onRetry?: () => void;
  compact?: boolean;
  message?: string;
}

type ErrorType = 'network' | 'permission' | 'server' | 'unknown';

function getErrorType(error: Error | null): ErrorType {
  if (!error) return 'unknown';
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('offline')) {
    return 'network';
  }
  if (message.includes('permission') || message.includes('denied') || message.includes('rls') || message.includes('policy')) {
    return 'permission';
  }
  if (message.includes('500') || message.includes('server') || message.includes('internal')) {
    return 'server';
  }
  return 'unknown';
}

const errorConfig: Record<ErrorType, { icon: typeof AlertCircle; title: string; description: string }> = {
  network: {
    icon: WifiOff,
    title: 'Connection Error',
    description: 'Please check your internet connection and try again.',
  },
  permission: {
    icon: ShieldX,
    title: 'Access Denied',
    description: 'You don\'t have permission to view this content. Try logging in again.',
  },
  server: {
    icon: ServerCrash,
    title: 'Server Error',
    description: 'Our servers are experiencing issues. Please try again later.',
  },
  unknown: {
    icon: AlertCircle,
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again.',
  },
};

export const QueryErrorFallback: FC<QueryErrorFallbackProps> = ({ 
  error, 
  onRetry, 
  compact = false,
  message 
}) => {
  const errorType = getErrorType(error);
  const config = errorConfig[errorType];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
        <Icon className="w-5 h-5 text-destructive flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">{config.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {message || config.description}
          </p>
        </div>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="flex-shrink-0">
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        {message || config.description}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      )}
    </Card>
  );
};

// Inline error for use within lists or grids
export const InlineError: FC<{ message?: string; onRetry?: () => void }> = ({ 
  message = 'Failed to load', 
  onRetry 
}) => (
  <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
    <AlertCircle className="w-4 h-4" />
    <span className="text-sm">{message}</span>
    {onRetry && (
      <Button variant="ghost" size="sm" onClick={onRetry} className="h-auto p-1">
        <RefreshCw className="w-3 h-3" />
      </Button>
    )}
  </div>
);
