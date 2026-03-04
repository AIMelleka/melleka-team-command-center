/**
 * Centralized API Service Layer
 * Handles all edge function calls with consistent error handling, retry logic, and caching
 */

import { supabase } from '@/integrations/supabase/client';
import { invokeWithRetry, RetryOptions } from './apiRetry';

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  cached: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  retryable: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  enabled?: boolean;
  ttl?: number; // Time to live in milliseconds
  key?: string; // Custom cache key
}

// ============================================================================
// Cache Manager
// ============================================================================

class CacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (ttl ?? this.defaultTTL),
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  // Get cache statistics
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

const cacheManager = new CacheManager();

// ============================================================================
// Error Handling
// ============================================================================

function createApiError(error: unknown, defaultMessage = 'An unexpected error occurred'): ApiError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const is5xx = message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504');
    const is429 = message.includes('429') || message.includes('rate limit');
    
    return {
      message: error.message || defaultMessage,
      retryable: is5xx || is429 || message.includes('network') || message.includes('timeout'),
      status: is5xx ? 500 : is429 ? 429 : undefined,
    };
  }
  
  return {
    message: defaultMessage,
    retryable: false,
  };
}

// ============================================================================
// Base API Call Function
// ============================================================================

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  options: {
    retry?: RetryOptions;
    cache?: CacheOptions;
    onRetry?: (attempt: number) => void;
  } = {}
): Promise<ApiResponse<T>> {
  const { retry, cache, onRetry } = options;
  
  // Check cache first
  const cacheKey = cache?.key || `${functionName}:${JSON.stringify(body)}`;
  if (cache?.enabled !== false) {
    const cached = cacheManager.get<T>(cacheKey);
    if (cached) {
      return { data: cached, error: null, cached: true };
    }
  }

  try {
    const { data, error } = await invokeWithRetry(
      () => supabase.functions.invoke(functionName, { body }),
      {
        maxRetries: retry?.maxRetries ?? 2,
        baseDelay: retry?.baseDelay ?? 1500,
        maxDelay: retry?.maxDelay ?? 15000,
        onRetry: (err, attempt, delay) => {
          console.warn(`[API] Retry ${attempt} for ${functionName}:`, err);
          onRetry?.(attempt);
          retry?.onRetry?.(err, attempt, delay);
        },
        ...retry,
      }
    );

    if (error) {
      return { 
        data: null, 
        error: createApiError(error), 
        cached: false 
      };
    }

    // Cache successful responses
    if (data && cache?.enabled !== false && cache?.ttl) {
      cacheManager.set(cacheKey, data, cache.ttl);
    }

    return { data: data as T, error: null, cached: false };
  } catch (err) {
    return { 
      data: null, 
      error: createApiError(err), 
      cached: false 
    };
  }
}

// ============================================================================
// API Service Methods
// ============================================================================

export const apiService = {
  // Website scraping
  async scrapeWebsite(
    url: string, 
    maxScreenshots = 6,
    onRetry?: (attempt: number) => void
  ): Promise<ApiResponse<{
    success: boolean;
    branding?: {
      logo?: string;
      favicon?: string;
      ogImage?: string;
      colors?: Record<string, string>;
      fonts?: Array<{ family: string }>;
      colorScheme?: string;
    };
    metadata?: { title?: string; description?: string };
    screenshot?: string;
    screenshots?: Array<{ url: string; screenshot: string | null; title: string }>;
    discoveredPages?: string[];
    content?: string;
    error?: string;
  }>> {
    return callEdgeFunction('scrape-website', { url, maxScreenshots }, {
      retry: { maxRetries: 2, baseDelay: 2000 },
      cache: { enabled: true, ttl: 30 * 60 * 1000, key: `scrape:${url}` }, // 30 min cache
      onRetry,
    });
  },

  // SEO data fetching
  async getSeoData(
    domain: string,
    onRetry?: (attempt: number) => void
  ): Promise<ApiResponse<{
    success: boolean;
    isMock?: boolean;
    data: {
      domain?: string;
      organicKeywords?: number;
      organicTraffic?: number;
      domainAuthority?: number;
      backlinks?: number;
      topKeywords?: Array<{ keyword: string; position: number; volume: number; difficulty: number }>;
      competitors?: Array<{ domain: string; commonKeywords: number; relevance?: number; organicTraffic?: number }>;
      keywordGap?: Array<{ keyword: string; competitorPosition: number; volume: number; difficulty: number; competitorDomain: string }>;
    };
  }>> {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return callEdgeFunction('get-seo-data', { domain: cleanDomain }, {
      retry: { maxRetries: 2, baseDelay: 1500 },
      cache: { enabled: true, ttl: 60 * 60 * 1000, key: `seo:${cleanDomain}` }, // 1 hour cache
      onRetry,
    });
  },

  // Proposal generation - returns a loosely typed object
  async generateProposal(
    params: Record<string, unknown>,
    onRetry?: (attempt: number) => void
  ): Promise<ApiResponse<{
    proposal: Record<string, unknown>;
  }>> {
    return callEdgeFunction('generate-proposal', params, {
      retry: { maxRetries: 3, baseDelay: 3000, maxDelay: 20000 },
      cache: { enabled: false }, // Don't cache generated proposals
      onRetry,
    });
  },

  // Ad transparency scraping
  async scrapeAdTransparency(
    advertiserName: string,
    onRetry?: (attempt: number) => void
  ): Promise<ApiResponse<{
    success: boolean;
    ads?: Array<{
      id: string;
      imageUrl?: string;
      text?: string;
      platform?: string;
      startDate?: string;
    }>;
    error?: string;
  }>> {
    return callEdgeFunction('scrape-ad-transparency', { advertiserName }, {
      retry: { maxRetries: 2, baseDelay: 2000 },
      cache: { enabled: true, ttl: 24 * 60 * 60 * 1000, key: `ads:${advertiserName}` }, // 24 hour cache
      onRetry,
    });
  },

  // Ad analysis
  async analyzeAd(
    adData: { imageUrl?: string; text?: string },
    onRetry?: (attempt: number) => void
  ): Promise<ApiResponse<{
    success: boolean;
    analysis?: {
      headline?: string;
      copy?: string;
      cta?: string;
      targetAudience?: string;
      strengths?: string[];
      improvements?: string[];
    };
    error?: string;
  }>> {
    return callEdgeFunction('analyze-ad', adData, {
      retry: { maxRetries: 2, baseDelay: 1500 },
      cache: { enabled: true, ttl: 60 * 60 * 1000 }, // 1 hour cache
      onRetry,
    });
  },

  // Proposal chatbot
  async chatWithProposal(
    params: {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      clientName: string;
      clientServices?: string[];
      clientDescription?: string;
    }
  ): Promise<Response> {
    // This returns a streaming response, so we handle it differently
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-chatbot`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(params),
      }
    );
    return response;
  },

  // Cache management
  cache: {
    invalidate: (key: string) => cacheManager.invalidate(key),
    invalidatePattern: (pattern: string) => cacheManager.invalidatePattern(pattern),
    invalidateSeo: (domain?: string) => {
      if (domain) {
        cacheManager.invalidate(`seo:${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`);
      } else {
        cacheManager.invalidatePattern('^seo:');
      }
    },
    invalidateScrape: (url?: string) => {
      if (url) {
        cacheManager.invalidate(`scrape:${url}`);
      } else {
        cacheManager.invalidatePattern('^scrape:');
      }
    },
    clear: () => cacheManager.clear(),
    stats: () => cacheManager.stats(),
  },
};

// ============================================================================
// React Query Integration Helpers
// ============================================================================

export const apiQueryKeys = {
  seo: (domain: string) => ['seo', domain] as const,
  scrape: (url: string) => ['scrape', url] as const,
  ads: (advertiser: string) => ['ads', advertiser] as const,
  proposal: (id: string) => ['proposal', id] as const,
};

// Export for direct usage
export { cacheManager };
export type { CacheOptions, RetryOptions };
