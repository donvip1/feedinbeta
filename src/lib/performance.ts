/**
 * Performance monitoring utilities
 */

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

/**
 * Performance monitoring class
 */
interface PerformanceMark {
  name: string;
  startTime: number;
  duration?: number;
}

class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: PerformanceMark[] = [];

  mark(name: string) {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string, endMark?: string) {
    const startTime = this.marks.get(startMark);
    if (!startTime) {
      console.warn(`Start mark "${startMark}" not found`);
      return;
    }

    const endTime = endMark ? this.marks.get(endMark) : performance.now();
    if (!endTime) {
      console.warn(`End mark "${endMark}" not found`);
      return;
    }

    const duration = endTime - startTime;
    this.measures.push({ name, startTime, duration });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  getMeasures() {
    return this.measures;
  }

  clearMarks() {
    this.marks.clear();
  }

  clearMeasures() {
    this.measures = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

export const measureAsync = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  
  performanceMonitor.mark(startMark);
  try {
    const result = await fn();
    performanceMonitor.mark(endMark);
    performanceMonitor.measure(name, startMark, endMark);
    return result;
  } catch (error) {
    performanceMonitor.mark(endMark);
    performanceMonitor.measure(name, startMark, endMark);
    throw error;
  }
};
