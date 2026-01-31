import whois from 'whois-json';
import fetch from 'node-fetch';
import { parse } from 'tldts';
import logger from '../logger.js';

function parseCreationDate(obj) {
  const candidates = [
    'creation_date', 'creationDate', 'createdDate', 'created', 'Creation Date', 'Created'
  ];
  for (const k of candidates) {
    if (obj && obj[k]) return new Date(obj[k]);
  }
  // Some APIs return nested data under "whois_record"
  if (obj && obj.whois_record) {
    return parseCreationDate(obj.whois_record);
  }
  return null;
}

function looksLikeApiNinjaKey(k) {
  if (!k || typeof k !== 'string') return false;
  if (k.includes(' ') || k.length < 10) return false;
  return true;
}

async function retryFetch(url, options = {}, attempts = 2, delayMs = 500) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...options });
      return res;
    } catch (err) {
      lastErr = err;
      logger.warn({ err: String(err), attempt: i + 1 }, 'Fetch attempt failed');
      if (i + 1 < attempts) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export async function getDomainAgeDays(inputUrl) {
  try {
    const { domain } = parse(inputUrl);
    if (!domain) return null;

    const apiKey = process.env.WHOIS_NINJA_API_KEY;
    const apiTimeout = Number(process.env.WHOIS_NINJA_TIMEOUT_MS || 7000);
    const apiAttempts = Number(process.env.WHOIS_NINJA_RETRIES || 2);

    if (apiKey) {
      if (!looksLikeApiNinjaKey(apiKey)) {
        logger.warn({ keySample: apiKey.slice(0, 8) + '...' }, 'WHOIS_NINJA_API_KEY appears malformed');
      }
      try {
        const url = `https://api.api-ninjas.com/v1/whois?domain=${encodeURIComponent(domain)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), apiTimeout);

        const resp = await retryFetch(url, { headers: { 'X-Api-Key': apiKey }, signal: controller.signal }, apiAttempts);
        clearTimeout(timeoutId);

        if (!resp.ok) {
          let bodyText = '';
          try { bodyText = await resp.text(); } catch (_) { bodyText = '<unreadable>'; }
          logger.warn({ status: resp.status, body: bodyText }, 'API Ninjas WHOIS non-OK');
        } else {
          const data = await resp.json();
          const createdAt = parseCreationDate(data);
          if (createdAt && !isNaN(createdAt.getTime())) {
            const days = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            return days;
          }
        }
      } catch (err) {
        logger.warn({ err: String(err) }, 'API Ninjas WHOIS failed');
      }
      // If API call fails or no date found, fall through to whois-json
    }

    // Fallback to whois-json with retries
    const whoisTimeout = Number(process.env.WHOIS_TIMEOUT_MS || 10000);
    const whoisAttempts = Number(process.env.WHOIS_RETRIES || 2);
    for (let i = 0; i < whoisAttempts; i++) {
      try {
        const data = await whois(domain, { follow: 3, verbose: false, timeout: whoisTimeout });
        const created = data.creationDate || data.createdDate || data['Creation Date'] || data['created'] || data['Created'];
        if (!created) {
          logger.warn({ domain, attempt: i + 1, raw: data }, 'whois-json returned no creation date');
        } else {
          const createdAt = new Date(created);
          if (!isNaN(createdAt.getTime())) {
            const days = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            return days;
          } else {
            logger.warn({ domain, created }, 'whois-json returned unparseable date');
          }
        }
      } catch (err) {
        logger.warn({ err: String(err), attempt: i + 1 }, 'WHOIS lookup failed');
        if (i + 1 < whoisAttempts) await new Promise(r => setTimeout(r, 500));
      }
    }

    return null;
  } catch (err) {
    logger.warn({ err: String(err) }, 'WHOIS lookup failed (outer)');
    return null;
  }
}
