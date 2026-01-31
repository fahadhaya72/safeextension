import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import fetch from 'node-fetch';
import { cache } from './cache.js';
import logger from './logger.js';
import { analyzeUrlSyntax, computeScore, classify, hasSuspiciousKeywords, isValidUrl, isIpObfuscation } from './scoring.js';
import { checkSafeBrowsing } from './services/safebrowsing.js';
import { getDomainAgeDays } from './services/whois.js';

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const MAX_URL_LENGTH = 2048;

app.use(helmet());
app.use(express.json());
app.use(cors({ origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN }));
app.use(morgan('combined'));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use('/api/', limiter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

async function checkRedirects(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual' });
    let redirects = 0;
    let location = res.headers.get('location');
    let currentUrl = url;
    while (location && redirects < 10) {
      redirects++;
      const nextUrl = new URL(location, currentUrl).toString();
      const r = await fetch(nextUrl, { method: 'GET', redirect: 'manual' });
      location = r.headers.get('location');
      currentUrl = nextUrl;
    }
    return { count: redirects, excessive: redirects > 3 };
  } catch (err) {
    logger.warn({ err: String(err) }, 'Redirect check failed');
    return { count: 0, excessive: false };
  }
}

function responseFromFactors(url, factors, extra) {
  const { score, classification, reasons } = computeScore(factors);
  const action = classify(score);
  return {
    url,
    score,
    action,
    risk_classification: classification,
    risk_factors: reasons,
    details: extra
  };
}

app.post('/api/check-url', async (req, res) => {
  try {
    const { url } = req.body || {};
    
    // Validation: Check if URL is provided
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        error: 'url_required',
        message: 'URL parameter is required and must be a string'
      });
    }

    // Validation: Check URL length
    if (url.length > MAX_URL_LENGTH) {
      return res.status(400).json({ 
        error: 'url_too_long',
        message: `URL must be less than ${MAX_URL_LENGTH} characters`
      });
    }

    // Validation: Basic URL format check
    if (!isValidUrl(url)) {
      return res.status(400).json({ 
        error: 'invalid_url',
        message: 'Invalid URL format'
      });
    }

    // Trim and normalize the URL
    const normalizedUrl = url.trim();

    const cacheKey = `check:${normalizedUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.info({ url: normalizedUrl, cached: true }, 'url_check_cached');
      return res.json(cached);
    }

    const syntax = analyzeUrlSyntax(normalizedUrl);
    const noHttps = syntax.protocol !== 'https';
    const suspicious = hasSuspiciousKeywords(normalizedUrl);
    const ipObfuscation = isIpObfuscation(syntax.hostname);

    const [sb, domainAgeDays, redirects] = await Promise.all([
      checkSafeBrowsing(normalizedUrl),
      getDomainAgeDays(normalizedUrl),
      checkRedirects(normalizedUrl)
    ]);

    const factors = {
      noHttps,
      youngDomain: (domainAgeDays !== null) ? domainAgeDays < 180 : false,
      ipObfuscation,
      listedInFeeds: !!sb.listed,
      suspiciousKeywords: suspicious,
      excessiveRedirects: redirects.excessive
    };

    const result = responseFromFactors(normalizedUrl, factors, {
      domainAgeDays,
      safeBrowsing: sb,
      redirects: redirects.count
    });

    cache.set(cacheKey, result);
    logger.info({ url: normalizedUrl, action: result.action, score: result.score }, 'decision');
    return res.json(result);
  } catch (err) {
    logger.error({ err: String(err), stack: err.stack }, 'check_url_error');
    return res.status(500).json({ 
      error: 'internal_error',
      message: 'An error occurred while checking the URL'
    });
  }
});

app.post('/api/risk-details', async (req, res) => {
  try {
    const { url } = req.body || {};
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        error: 'url_required',
        message: 'URL parameter is required and must be a string'
      });
    }

    if (url.length > MAX_URL_LENGTH) {
      return res.status(400).json({ 
        error: 'url_too_long',
        message: `URL must be less than ${MAX_URL_LENGTH} characters`
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({ 
        error: 'invalid_url',
        message: 'Invalid URL format'
      });
    }

    const normalizedUrl = url.trim();
    const cacheKey = `check:${normalizedUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.info({ url: normalizedUrl, cached: true }, 'risk_details_cached');
      return res.json(cached);
    }
    
    // Fallback: compute on-demand identical to /check-url
    const syntax = analyzeUrlSyntax(normalizedUrl);
    const noHttps = syntax.protocol !== 'https';
    const suspicious = hasSuspiciousKeywords(normalizedUrl);
    const ipObfuscation = isIpObfuscation(syntax.hostname);

    const [sb, domainAgeDays, redirects] = await Promise.all([
      checkSafeBrowsing(normalizedUrl),
      getDomainAgeDays(normalizedUrl),
      checkRedirects(normalizedUrl)
    ]);

    const factors = {
      noHttps,
      youngDomain: (domainAgeDays !== null) ? domainAgeDays < 180 : false,
      ipObfuscation,
      listedInFeeds: !!sb.listed,
      suspiciousKeywords: suspicious,
      excessiveRedirects: redirects.excessive
    };

    const result = responseFromFactors(normalizedUrl, factors, {
      domainAgeDays,
      safeBrowsing: sb,
      redirects: redirects.count
    });

    cache.set(cacheKey, result);
    return res.json(result);
  } catch (err) {
    logger.error({ err: String(err), stack: err.stack }, 'risk_details_error');
    return res.status(500).json({ 
      error: 'internal_error',
      message: 'An error occurred while analyzing the URL'
    });
  }
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'SafeExtension backend listening');
});

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error: String(error), stack: error.stack }, 'Uncaught Exception');
  process.exit(1);
});
