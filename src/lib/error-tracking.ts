interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export const logError = (error: Error, context?: ErrorContext) => {
  console.error('[Error Log]', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...context,
  });

  // In production, this could send to an error tracking service
  // e.g., Sentry, Rollbar, etc.
};

export const logWarning = (message: string, context?: ErrorContext) => {
  console.warn('[Warning]', {
    message,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

export const logInfo = (message: string, metadata?: Record<string, any>) => {
  console.log('[Info]', {
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};
