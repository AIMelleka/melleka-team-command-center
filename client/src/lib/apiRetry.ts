/**
 * Retry utility with exponential backoff for API calls
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryOn?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  retryOn: (error) => {
    // Retry on network errors and 5xx server errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('network') || message.includes('fetch')) return true;
    }
    return true; // Default to retry
  },
  onRetry: () => {},
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffFactor: number
): number {
  const exponentialDelay = baseDelay * Math.pow(backoffFactor, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt > opts.maxRetries || !opts.retryOn(error, attempt)) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(
        attempt,
        opts.baseDelay,
        opts.maxDelay,
        opts.backoffFactor
      );

      opts.onRetry(error, attempt, delay);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Wrapper for Supabase function calls with retry
 */
export async function invokeWithRetry<T>(
  supabaseFn: () => Promise<{ data: T | null; error: Error | null }>,
  options: RetryOptions = {}
): Promise<{ data: T; error: null } | { data: null; error: Error }> {
  const mergedOptions: RetryOptions = {
    ...options,
    retryOn: (error, attempt) => {
      // Don't retry client errors (4xx) except rate limits (429)
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('400') || message.includes('401') || 
            message.includes('403') || message.includes('404')) {
          return false;
        }
        // Always retry rate limits and server errors
        if (message.includes('429') || message.includes('5')) {
          return true;
        }
      }
      return options.retryOn?.(error, attempt) ?? true;
    },
  };

  try {
    const result = await withRetry(async () => {
      const { data, error } = await supabaseFn();
      if (error) throw error;
      return data;
    }, mergedOptions);

    return { data: result as T, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Wrapper for fetch calls with retry
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, init);
    
    // Throw on server errors to trigger retry
    if (response.status >= 500 || response.status === 429) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  }, {
    ...options,
    retryOn: (error, attempt) => {
      if (error instanceof Error) {
        const message = error.message;
        // Retry on rate limits (429) and server errors (5xx)
        if (message.includes('429') || message.includes('5')) {
          return true;
        }
        // Retry on network errors
        if (message.includes('network') || message.includes('fetch') || message.includes('Failed')) {
          return true;
        }
      }
      return options.retryOn?.(error, attempt) ?? false;
    },
  });
}

/**
 * Create a retry-enabled version of any async function
 */
export function createRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: Parameters<T>) => withRetry(() => fn(...args), options)) as T;
}
