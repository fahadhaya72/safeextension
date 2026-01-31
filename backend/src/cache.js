import { LRUCache } from 'lru-cache';

const ttl = Number(process.env.CACHE_TTL_SECONDS || 900) * 1000;

export const cache = new LRUCache({
  max: 500,
  ttl
});
