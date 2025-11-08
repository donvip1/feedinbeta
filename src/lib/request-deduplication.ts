type PendingRequest<T> = Promise<T>;

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<any>>();

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Check if there's already a pending request for this key
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new request
    const promise = fn()
      .finally(() => {
        // Clean up after request completes
        this.pendingRequests.delete(key);
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  clear(key?: string) {
    if (key) {
      this.pendingRequests.delete(key);
    } else {
      this.pendingRequests.clear();
    }
  }

  hasPending(key: string): boolean {
    return this.pendingRequests.has(key);
  }
}

export const requestDeduplicator = new RequestDeduplicator();

export const dedupeRequest = <T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> => {
  return requestDeduplicator.dedupe(key, fn);
};
