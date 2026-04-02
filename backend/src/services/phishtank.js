import fetch from 'node-fetch';
import logger from '../logger.js';

const API_KEY = process.env.PHISHTANK_API_KEY || '';
const ENDPOINT = 'https://checkurl.phishtank.com/checkurl/';
const TIMEOUT_MS = 3000;

export async function checkPhishTank(url) {
  if (!API_KEY) {
    logger.warn('PhishTank API key not configured');
    return { listed: false, source: 'phishtank', note: 'api_key_missing' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('url', url);
    formData.append('format', 'json');
    formData.append('app_key', API_KEY);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SafeExtension/1.0'
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      logger.warn({ status: res.status }, 'PhishTank API non-OK response');
      return { listed: false, source: 'phishtank', note: 'api_error' };
    }

    const data = await res.json();

    if (data?.results?.in_database) {
      const result = data.results;
      const listed = result.valid && result.verified;
      const details = listed ? {
        phish_id: result.phish_id,
        phish_detail_url: result.phish_detail_url,
        verified: result.verified,
        verification_time: result.verification_time
      } : {};

      return {
        listed,
        details,
        source: 'phishtank',
        confidence: listed ? 95 : 0 // PhishTank is highly reliable
      };
    }

    return { listed: false, source: 'phishtank' };

  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('PhishTank API request timeout');
      return { listed: false, source: 'phishtank', note: 'timeout' };
    }
    logger.error({ err: String(err) }, 'PhishTank check failed');
    return { listed: false, source: 'phishtank', note: 'exception' };
  }
}