import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CacheManager } from '@/lib/cache-manager';
import { PreferenceManager } from '@/lib/cookie-manager';
import { SessionManager } from '@/lib/session-manager';
import { Trash2, Database, RefreshCw, HardDrive } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export function CacheSettings() {
  const { toast } = useToast();
  const [cacheSize, setCacheSize] = useState<{ name: string; size: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCacheSize();
  }, []);

  const loadCacheSize = async () => {
    try {
      const sizes = await CacheManager.getSize();
      setCacheSize(sizes);
    } catch (error) {
      console.error('Failed to get cache size:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
  };

  const handleClearCache = async () => {
    setLoading(true);
    try {
      await CacheManager.clearAll();
      await loadCacheSize();
      toast({
        title: 'Cache cleared',
        description: 'All cached files have been removed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear cache',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearCookies = () => {
    PreferenceManager.clearAll();
    toast({
      title: 'Preferences cleared',
      description: 'All saved preferences have been reset',
    });
  };

  const handleClearSessions = () => {
    SessionManager.clearAll();
    toast({
      title: 'Session data cleared',
      description: 'All session data has been removed',
    });
  };

  const totalSize = cacheSize.reduce((acc, cache) => acc + cache.size, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Cache Storage
          </CardTitle>
          <CardDescription>
            Manage cached files to improve app performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Total Cache Size</span>
              <span className="text-sm font-semibold">{formatBytes(totalSize)}</span>
            </div>
            {cacheSize.map((cache) => (
              <div key={cache.name} className="flex items-center justify-between py-2 border-t">
                <span className="text-xs text-muted-foreground">{cache.name}</span>
                <span className="text-xs">{formatBytes(cache.size)}</span>
              </div>
            ))}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={loading}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Cache
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all cache?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all cached files. The app will re-download assets on next use.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearCache}>Clear Cache</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Cookies & Sessions
          </CardTitle>
          <CardDescription>
            Manage cookies and session data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" onClick={handleClearCookies} className="w-full">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Preferences
          </Button>
          
          <Button variant="outline" onClick={handleClearSessions} className="w-full">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Session Data
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Cache Strategy
          </CardTitle>
          <CardDescription>
            How caching works in FEEDIN
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Static assets (JS, CSS) are cached for fast loading</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Images are cached to reduce data usage</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>API calls are never cached (always fresh data)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Cache auto-updates when new app version is deployed</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Offline fallback available when no connection</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
