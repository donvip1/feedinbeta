import { WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface OfflineBannerProps {
  isOffline: boolean;
  lastSyncTime: Date | null;
  onRetry?: () => void;
}

export const OfflineBanner = ({ isOffline, lastSyncTime, onRetry }: OfflineBannerProps) => {
  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-amber-500">
                    You're offline
                  </span>
                  {lastSyncTime && (
                    <span className="text-xs text-muted-foreground">
                      Last synced {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
              {onRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRetry}
                  className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
