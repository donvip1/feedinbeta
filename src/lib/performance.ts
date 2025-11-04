/**
 * Performance monitoring utilities
 */

interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  loadTime?: number;
  domContentLoaded?: number;
  resourceCount?: number;
  totalResourceSize?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private observer: PerformanceObserver | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    this.initializeObservers();
    this.trackNavigationTiming();
    this.trackResourceTiming();
  }

  private initializeObservers() {
    try {
      // Track Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
        console.log(`[Performance] LCP: ${this.metrics.lcp.toFixed(2)}ms`);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Track First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.fid = entry.processingStart - entry.startTime;
          console.log(`[Performance] FID: ${this.metrics.fid.toFixed(2)}ms`);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Track Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.metrics.cls = clsValue;
        console.log(`[Performance] CLS: ${this.metrics.cls.toFixed(4)}`);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.warn('[Performance] Some observers not supported:', e);
    }
  }

  private trackNavigationTiming() {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigation) {
        this.metrics.ttfb = navigation.responseStart - navigation.requestStart;
        this.metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
        this.metrics.loadTime = navigation.loadEventEnd - navigation.fetchStart;
        this.metrics.fcp = this.getFirstContentfulPaint();

        console.log('[Performance] Navigation Metrics:', {
          'TTFB': `${this.metrics.ttfb.toFixed(2)}ms`,
          'DOM Content Loaded': `${this.metrics.domContentLoaded.toFixed(2)}ms`,
          'Page Load Time': `${this.metrics.loadTime.toFixed(2)}ms`,
          'FCP': this.metrics.fcp ? `${this.metrics.fcp.toFixed(2)}ms` : 'N/A'
        });
      }
    });
  }

  private getFirstContentfulPaint(): number | undefined {
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return fcpEntry?.startTime;
  }

  private trackResourceTiming() {
    window.addEventListener('load', () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      this.metrics.resourceCount = resources.length;
      this.metrics.totalResourceSize = resources.reduce((total, resource) => {
        return total + (resource.transferSize || 0);
      }, 0);

      const jsResources = resources.filter(r => r.name.includes('.js'));
      const cssResources = resources.filter(r => r.name.includes('.css'));
      const imageResources = resources.filter(r => r.initiatorType === 'img');

      console.log('[Performance] Resource Metrics:', {
        'Total Resources': this.metrics.resourceCount,
        'Total Size': `${(this.metrics.totalResourceSize / 1024).toFixed(2)} KB`,
        'JS Files': jsResources.length,
        'CSS Files': cssResources.length,
        'Images': imageResources.length
      });

      // Log largest resources
      const largestResources = resources
        .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
        .slice(0, 5);

      if (largestResources.length > 0) {
        console.log('[Performance] Top 5 Largest Resources:');
        largestResources.forEach((resource, index) => {
          const size = (resource.transferSize || 0) / 1024;
          const name = resource.name.split('/').pop() || resource.name;
          console.log(`  ${index + 1}. ${name}: ${size.toFixed(2)} KB`);
        });
      }
    });
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public logSummary() {
    console.log('[Performance] Summary:', this.metrics);
  }
}

// Initialize performance monitor
let performanceMonitor: PerformanceMonitor | null = null;

export const initPerformanceMonitoring = () => {
  if (typeof window !== 'undefined' && !performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
    console.log('[Performance] Monitoring initialized');
  }
};

export const getPerformanceMetrics = (): PerformanceMetrics => {
  return performanceMonitor?.getMetrics() || {};
};

// ... keep existing code

/**
 * Debounce function to limit rate of function calls
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function to ensure function is called at most once per time period
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Lazy load images with intersection observer
 */
export const lazyLoadImage = (img: HTMLImageElement) => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const target = entry.target as HTMLImageElement;
        const src = target.dataset.src;
        if (src) {
          target.src = src;
          target.removeAttribute('data-src');
        }
        observer.unobserve(target);
      }
    });
  });

  observer.observe(img);
};

/**
 * Measure component render time
 */
export const measureRenderTime = (componentName: string, callback: () => void) => {
  const start = performance.now();
  callback();
  const end = performance.now();
  console.log(`${componentName} rendered in ${(end - start).toFixed(2)}ms`);
};

/**
 * Preload critical resources
 */
export const preloadResource = (url: string, type: 'image' | 'script' | 'style') => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.as = type;
  document.head.appendChild(link);
};

/**
 * Cache data in localStorage with expiry
 */
export const cacheWithExpiry = <T>(
  key: string,
  data: T,
  expiryMinutes: number = 30
): void => {
  const item = {
    value: data,
    expiry: Date.now() + expiryMinutes * 60 * 1000,
  };
  localStorage.setItem(key, JSON.stringify(item));
};

/**
 * Get cached data from localStorage
 */
export const getCachedData = <T>(key: string): T | null => {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) return null;

  try {
    const item = JSON.parse(itemStr);
    if (Date.now() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return item.value;
  } catch {
    return null;
  }
};
