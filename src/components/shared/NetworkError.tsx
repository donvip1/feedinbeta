import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WifiOff } from 'lucide-react';

interface NetworkErrorProps {
  onRetry?: () => void;
}

export const NetworkError = ({ onRetry }: NetworkErrorProps) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
          <WifiOff className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Connection Lost</h3>
        <p className="text-muted-foreground mb-6">
          Unable to connect to the server. Please check your internet connection and try again.
        </p>
        {onRetry && (
          <Button onClick={onRetry} className="w-full bg-gradient-primary">
            Try Again
          </Button>
        )}
      </Card>
    </div>
  );
};
