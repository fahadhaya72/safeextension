import fetch from 'node-fetch';
import logger from '../logger.js';

const API_KEY = process.env.SAFE_BROWSING_API_KEY || '';
const ENDPOINT = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`;
const TIMEOUT_MS = 5000;

export async function checkSafeBrowsing(url) {
  if (!API_KEY) {
    logger.warn('Safe Browsing API key not configured');
    return { listed: false, source: 'google_safebrowsing', note: 'api_key_missing' };
  }
  
  try {
    const body = {
      client: { clientId: 'safeextension', clientVersion: '1.0' },
      threatInfo: {
        threatTypes: ['MALWARE','SOCIAL_ENGINEERING','UNWANTED_SOFTWARE','POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }]
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      logger.warn({ status: res.status }, 'SafeBrowsing API non-OK response');
      return { listed: false, source: 'google_safebrowsing', note: 'api_error' };
    }
    
    const data = await res.json();
    const listed = Array.isArray(data?.matches) && data.matches.length > 0;
    const details = listed ? data.matches.map(m => ({ threatType: m.threatType, platformType: m.platformType })) : [];
    return { listed, details, source: 'google_safebrowsing' };
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('SafeBrowsing API request timeout');
      return { listed: false, source: 'google_safebrowsing', note: 'timeout' };
    }
    logger.error({ err: String(err) }, 'SafeBrowsing check failed');
    return { listed: false, source: 'google_safebrowsing', note: 'exception' };
  }
}
