import { LRUCache } from 'lru-cache';

const DEFAULT_TTL = Number(process.env.CACHE_TTL_SECONDS || 900) * 1000; // 15 minutes default
const MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES || 5000); // Increased from 500
const MAX_SIZE_MB = Number(process.env.CACHE_MAX_SIZE_MB || 50); // 50MB max

export const cache = new LRUCache({
  max: MAX_ENTRIES,
  ttl: DEFAULT_TTL,
  sizeCalculation: (entry) => {
    // Calculate memory usage of entry
    return JSON.stringify(entry).length;
  },
  maxSize: MAX_SIZE_MB * 1024 * 1024, // Convert MB to bytes
  updateAgeOnGet: true, // Refresh TTL on access
  updateAgeOnHas: true,
  allowStale: false // Don't return expired entries
});

// Enhanced cache operations with per-entry TTL support
export function setWithTTL(key, value, ttlMs = DEFAULT_TTL) {
  return cache.set(key, value, { ttl: ttlMs });
}

export function getWithDefault(key, defaultValue = null) {
  return cache.get(key) ?? defaultValue;
}

// Cache statistics for monitoring
export function getCacheStats() {
  return {
    size: cache.size,
    maxSize: cache.maxSize,
    entryCount: cache.size,
    maxEntries: cache.max,
    hitRate: cache.calculatedSize ? (cache.calculatedSize / cache.maxSize) : 0
  };
}

// Clear expired entries (force cleanup)
export function cleanup() {
  // LRUCache handles this automatically, but we can force it
  cache.purgeStale();
}

// Invalidate cache entries matching a pattern
export function invalidatePattern(pattern) {
  const keysToDelete = [];

  for (const [key] of cache.entries()) {
    if (typeof key === 'string' && key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => cache.delete(key));
  return keysToDelete.length;
}
