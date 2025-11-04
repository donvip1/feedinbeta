import React, { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const DevHealthCheck: React.FC = () => {
  const [hasMultipleReactInstances, setHasMultipleReactInstances] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Only run in development
    if (import.meta.env.PROD) return;

    // Check for multiple React instances by testing if hooks work
    let multipleInstances = false;
    
    try {
      // Try to detect if React is in an invalid state
      const React = (window as any).React;
      if (React) {
        // Check if there are multiple React versions loaded
        const reactVersions = new Set();
        const scripts = document.querySelectorAll('script[src*="react"]');
        scripts.forEach(script => {
          const src = script.getAttribute('src');
          if (src) reactVersions.add(src);
        });
        
        if (reactVersions.size > 1) {
          multipleInstances = true;
        }
      }

      // Additional check: look for common symptoms
      const errorListener = (event: ErrorEvent) => {
        const message = event.message || '';
        if (
          message.includes('Invalid hook call') ||
          message.includes('Cannot read properties of null') ||
          message.includes('useRef') ||
          message.includes('useState') ||
          message.includes('useContext')
        ) {
          multipleInstances = true;
          setHasMultipleReactInstances(true);
        }
      };

      window.addEventListener('error', errorListener);

      // Check console errors
      const originalError = console.error;
      console.error = (...args: any[]) => {
        const message = args.join(' ');
        if (
          message.includes('Invalid hook call') ||
          message.includes('more than one copy of React')
        ) {
          multipleInstances = true;
          setHasMultipleReactInstances(true);
        }
        originalError.apply(console, args);
      };

      return () => {
        window.removeEventListener('error', errorListener);
        console.error = originalError;
      };
    } catch (error) {
      // If we can't check, assume it's fine
      console.warn('Health check failed:', error);
    }
  }, []);

  // Don't show in production or if dismissed
  if (import.meta.env.PROD || isDismissed || !hasMultipleReactInstances) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] p-4 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto">
        <Alert variant="destructive" className="border-2 border-destructive shadow-lg">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="flex items-center justify-between text-lg font-bold">
            <span>⚠️ Multiple React Instances Detected</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-destructive/20"
              onClick={() => setIsDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription className="mt-3 space-y-3">
            <p className="font-semibold">
              Your app has multiple React instances loaded, causing hooks to fail.
            </p>
            
            <div className="space-y-2 text-sm">
              <p className="font-medium">Quick Fixes:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Hard refresh: Press <kbd className="px-2 py-1 bg-background/20 rounded">Ctrl+Shift+R</kbd> (Windows) or <kbd className="px-2 py-1 bg-background/20 rounded">Cmd+Shift+R</kbd> (Mac)</li>
                <li>Clear Vite cache: Stop dev server, delete <code className="px-1.5 py-0.5 bg-background/20 rounded">node_modules/.vite</code>, restart</li>
                <li>Check vite.config.ts has proper React deduplication configured</li>
                <li>Ensure all packages use compatible React versions</li>
              </ol>
            </div>

            <div className="text-xs opacity-90 mt-2">
              <p>Common causes: Browser cache, outdated dependencies, or improper bundler config</p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};
