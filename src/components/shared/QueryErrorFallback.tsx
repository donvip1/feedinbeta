import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, RefreshCw, WifiOff, ServerCrash, ShieldX, LogIn } from 'lucide-react';
import type { FC } from 'react';
import { getFriendlyError } from '@/lib/error-messages';

interface QueryErrorFallbackProps {
  error: Error | null;
  onRetry?: () => void;
  compact?: boolean;
  message?: string;
}

type ErrorType = 'network' | 'permission' | 'server' | 'auth' | 'unknown';

function getErrorType(error: Error | null): ErrorType {
  if (!error) return 'unknown';
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('offline')) {
    return 'network';
  }
  if (message.includes('401') || message.includes('jwt') || message.includes('session') || message.includes('token')) {
    return 'auth';
  }
  if (message.includes('permission') || message.includes('denied') || message.includes('rls') || message.includes('policy') || message.includes('403')) {
    return 'permission';
  }
  if (message.includes('500') || message.includes('server') || message.includes('internal')) {
    return 'server';
  }
  return 'unknown';
}

const errorIcons: Record<ErrorType, typeof AlertCircle> = {
  network: WifiOff,
  permission: ShieldX,
  server: ServerCrash,
  auth: LogIn,
  unknown: AlertCircle,
};

export const QueryErrorFallback: FC<QueryErrorFallbackProps> = ({ 
  error, 
  onRetry, 
  compact = false,
  message 
}) => {
  const errorType = getErrorType(error);
  const friendly = getFriendlyError(error?.message || 'unknown');
  const Icon = errorIcons[errorType];

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
        <Icon className="w-5 h-5 text-destructive flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">{friendly.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {message || friendly.description}
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
      <h3 className="text-lg font-semibold mb-2">{friendly.title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        {message || friendly.description}
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
