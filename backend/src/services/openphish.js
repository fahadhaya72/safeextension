import fetch from 'node-fetch';
import logger from '../logger.js';

const ENDPOINT = 'https://openphish.com/feed.txt';
const TIMEOUT_MS = 3000;

// Cache for the phishing feed (updated periodically)
let feedCache = {
  urls: new Set(),
  lastUpdate: 0,
  ttl: 3600000 // 1 hour
};

export async function checkOpenPhish(url) {
  try {
    const now = Date.now();

    // Update cache if needed
    if (now - feedCache.lastUpdate > feedCache.ttl) {
      await updateFeedCache();
    }

    // Normalize URL for comparison
    const normalizedUrl = url.toLowerCase().replace(/^https?:\/\//, '');

    const listed = feedCache.urls.has(normalizedUrl);
    const confidence = listed ? 90 : 0; // OpenPhish is community-verified

    return {
      listed,
      source: 'openphish',
      confidence,
      details: listed ? { feed_size: feedCache.urls.size } : {}
    };

  } catch (err) {
    logger.error({ err: String(err) }, 'OpenPhish check failed');
    return { listed: false, source: 'openphish', note: 'exception' };
  }
}

async function updateFeedCache() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(ENDPOINT, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      logger.warn({ status: res.status }, 'OpenPhish feed fetch failed');
      return;
    }

    const text = await res.text();
    const urls = text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(url => url.toLowerCase().replace(/^https?:\/\//, ''));

    feedCache.urls = new Set(urls);
    feedCache.lastUpdate = Date.now();

    logger.info({ urlCount: urls.length }, 'Updated OpenPhish feed cache');

  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('OpenPhish feed update timeout');
    } else {
      logger.error({ err: String(err) }, 'OpenPhish feed update failed');
    }
  }
}