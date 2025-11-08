import { logError, logWarning, logInfo } from './error-tracking';

interface MonitoringConfig {
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  enableUserTracking: boolean;
}

class Monitoring {
  private config: MonitoringConfig = {
    enablePerformanceTracking: true,
    enableErrorTracking: true,
    enableUserTracking: true,
  };

  configure(config: Partial<MonitoringConfig>) {
    this.config = { ...this.config, ...config };
  }

  trackPageView(path: string, metadata?: Record<string, any>) {
    if (!this.config.enableUserTracking) return;
    
    logInfo('Page view', {
      path,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  trackEvent(name: string, properties?: Record<string, any>) {
    if (!this.config.enableUserTracking) return;
    
    logInfo(`Event: ${name}`, properties);
  }

  trackError(error: Error, context?: Record<string, any>) {
    if (!this.config.enableErrorTracking) return;
    
    logError(error, context);
  }

  trackPerformance(metric: string, value: number, metadata?: Record<string, any>) {
    if (!this.config.enablePerformanceTracking) return;
    
    logInfo(`Performance: ${metric}`, {
      value,
      unit: 'ms',
      ...metadata,
    });
  }

  setUser(userId: string, traits?: Record<string, any>) {
    logInfo('User identified', {
      userId,
      ...traits,
    });
  }

  clearUser() {
    logInfo('User cleared');
  }
}

export const monitoring = new Monitoring();

export const trackPageView = (path: string, metadata?: Record<string, any>) => {
  monitoring.trackPageView(path, metadata);
};

export const trackEvent = (name: string, properties?: Record<string, any>) => {
  monitoring.trackEvent(name, properties);
};

export const trackError = (error: Error, context?: Record<string, any>) => {
  monitoring.trackError(error, context);
};

export const trackPerformance = (metric: string, value: number, metadata?: Record<string, any>) => {
  monitoring.trackPerformance(metric, value, metadata);
};
