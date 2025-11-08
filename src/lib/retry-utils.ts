interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      onRetry?.(attempt, lastError);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
};

export const isNetworkError = (error: any): boolean => {
  return (
    error?.message?.includes('network') ||
    error?.message?.includes('fetch') ||
    error?.code === 'NETWORK_ERROR' ||
    error?.status === 0
  );
};

export const shouldRetry = (error: any, attempt: number): boolean => {
  if (attempt >= 3) return false;
  
  // Retry on network errors
  if (isNetworkError(error)) return true;
  
  // Retry on specific status codes
  const status = error?.status || error?.response?.status;
  return status === 408 || status === 429 || status === 503 || status === 504;
};
