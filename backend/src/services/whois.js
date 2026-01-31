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

    // Fallback: use RDAP (JSON) lookup which is widely available and returns events
    try {
      const rdapUrl = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
      const rdapResp = await retryFetch(rdapUrl, { timeout: 8000 }, 2);
      if (rdapResp && rdapResp.ok) {
        const rdapData = await rdapResp.json();
        // RDAP may include events array with registration/registrationDate
        if (Array.isArray(rdapData.events)) {
          const reg = rdapData.events.find(e => /regist/i.test(e.eventAction) || /registration/i.test(e.eventAction));
          if (reg && reg.eventDate) {
            const createdAt = new Date(reg.eventDate);
            if (!isNaN(createdAt.getTime())) {
              const days = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
              return days;
            }
          }
        }
        // Some RDAP responses include 'registration' or 'registrationDate' directly
        if (rdapData.registration) {
          const createdAt = new Date(rdapData.registration);
          if (!isNaN(createdAt.getTime())) return Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
    } catch (err) {
      logger.warn({ err: String(err) }, 'RDAP lookup failed');
    }

    return null;
  } catch (err) {
    logger.warn({ err: String(err) }, 'WHOIS lookup failed (outer)');
    return null;
  }
}
