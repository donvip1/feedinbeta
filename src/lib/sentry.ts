/**
 * Sentry Crash Reporting & Error Tracking
 * Provides real-time error monitoring for production builds
 */

import * as Sentry from '@sentry/react';

let isInitialized = false;

/**
 * Initialize Sentry for crash reporting
 * Only runs in production to avoid noise during development
 */
export function initSentry(): void {
  if (isInitialized) return;
  
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  // Only initialize if DSN is provided and in production
  if (!dsn) {
    console.log('[Sentry] No DSN configured, skipping initialization');
    return;
  }

  if (!import.meta.env.PROD) {
    console.log('[Sentry] Skipping initialization in development mode');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: `feedin@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
      
      // Performance Monitoring
      tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
      
      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions for replay
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
      
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          // Mask all text to protect user privacy
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Filter out known non-critical errors
      beforeSend(event, hint) {
        const error = hint.originalException;
        
        // Ignore network errors that are expected
        if (error instanceof Error) {
          if (error.message.includes('Failed to fetch')) {
            return null; // Don't send network errors
          }
          if (error.message.includes('Load failed')) {
            return null; // Don't send load failures
          }
          if (error.message.includes('ResizeObserver')) {
            return null; // Don't send resize observer errors
          }
        }
        
        return event;
      },
    });

    isInitialized = true;
    console.log('[Sentry] Initialized successfully');
  } catch (error) {
    console.warn('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Capture an exception and send to Sentry
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
): void {
  if (!isInitialized) {
    console.error('[Sentry] Not initialized, logging locally:', error.message);
    return;
  }

  console.error('[Sentry] Capturing exception:', error.message);
  Sentry.captureException(error, { extra: context });
}

/**
 * Capture a message with optional severity level
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  if (!isInitialized) return;
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 * Call this after user login
 */
export function setUser(
  userId: string,
  email?: string,
  username?: string
): void {
  if (!isInitialized) return;
  
  Sentry.setUser({
    id: userId,
    email,
    username,
  });
  console.log('[Sentry] User context set');
}

/**
 * Clear user context
 * Call this on logout
 */
export function clearUser(): void {
  if (!isInitialized) return;
  Sentry.setUser(null);
  console.log('[Sentry] User context cleared');
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!isInitialized) return;
  
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

/**
 * Set custom tag for filtering in Sentry dashboard
 */
export function setTag(key: string, value: string): void {
  if (!isInitialized) return;
  Sentry.setTag(key, value);
}

export default {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  setTag,
};
