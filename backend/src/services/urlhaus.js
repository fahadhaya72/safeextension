import fetch from 'node-fetch';
import logger from '../logger.js';

const ENDPOINT = 'https://urlhaus-api.abuse.ch/v1/url/';
const TIMEOUT_MS = 3000;

export async function checkURLhaus(url) {
  try {
    const formData = new URLSearchParams();
    formData.append('url', url);

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
      logger.warn({ status: res.status }, 'URLhaus API non-OK response');
      return { listed: false, source: 'urlhaus', note: 'api_error' };
    }

    const data = await res.json();

    if (data?.query_status === 'ok' && data?.url_status?.urlhaus_reference) {
      const listed = true;
      const details = {
        id: data.id,
        urlhaus_reference: data.urlhaus_reference,
        url_status: data.url_status,
        host: data.host,
        date_added: data.date_added,
        threat: data.threat,
        tags: data.tags
      };

      return {
        listed,
        details,
        source: 'urlhaus',
        confidence: 95 // URLhaus is highly reliable for malware distribution
      };
    }

    return { listed: false, source: 'urlhaus' };

  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('URLhaus API request timeout');
      return { listed: false, source: 'urlhaus', note: 'timeout' };
    }
    logger.error({ err: String(err) }, 'URLhaus check failed');
    return { listed: false, source: 'urlhaus', note: 'exception' };
  }
}