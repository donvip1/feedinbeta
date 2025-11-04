import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { CacheManager } from '@/lib/cache-manager';

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setShowUpdate(true);
    };

    window.addEventListener('app-update-available', handleUpdate);

    return () => {
      window.removeEventListener('app-update-available', handleUpdate);
    };
  }, []);

  const handleUpdate = async () => {
    await CacheManager.updateToNewVersion();
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-gradient-to-r from-primary to-purple-600 rounded-lg p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">New Update Available</p>
            <p className="text-white/80 text-xs">Click to refresh and get the latest features</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20"
            onClick={() => setShowUpdate(false)}
          >
            Later
          </Button>
          <Button
            size="sm"
            className="bg-white text-primary hover:bg-white/90"
            onClick={handleUpdate}
          >
            Update Now
          </Button>
        </div>
      </div>
    </div>
  );
}
