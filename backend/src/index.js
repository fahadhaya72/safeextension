import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import fetch from 'node-fetch';
import { cache } from './cache.js';
import logger from './logger.js';
import { 
  evaluateURL,
  classify, 
  analyzeUrlSyntax,
  isValidUrl
} from './scoring-refactored.js';
import {
  hasSuspiciousKeywords,
  hasAdultContent,
  isIpObfuscation,
  isTemporaryService,
  hasSuspiciousSubdomain,
  analyzeURLStructure,
  computeWeightedScore
} from './scoring.js';
import { checkSafeBrowsing } from './services/safebrowsing.js';
import { getDomainAgeDays } from './services/whois.js';
import { detectBrandImpersonation, getGeographicRisk, analyzeCertificate, getReputationScore, hasSuspiciousTLD } from './advanced-scoring.js';
import { authenticateRequest, createAuthenticatedRateLimit } from './auth.js';

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const MAX_URL_LENGTH = 2048;
const API_KEY = process.env.SAFEEXTENSION_API_KEY;
const EXTENSION_ID = process.env.CHROME_EXTENSION_ID;

// Security middleware with enhanced headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(express.json({ limit: '10mb' }));
// CORS configuration to support multiple origins
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, and file://)
    if (!origin) return callback(null, true);
    
    // Allow null origin (file:// protocol)
    if (origin === 'null') return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'https://safeextension.vercel.app',
      'chrome-extension://your_extension_id',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // If ALLOWED_ORIGIN is set to '*', allow all origins (development only)
    if (ALLOWED_ORIGIN === '*') {
      return callback(null, true);
    }
    
    // Check if the origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check if the origin matches the ALLOWED_ORIGIN env var
    if (ALLOWED_ORIGIN && ALLOWED_ORIGIN !== '*' && origin === ALLOWED_ORIGIN) {
      return callback(null, true);
    }
    
    // Block all other origins
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Extension-ID']
};

app.use(cors(corsOptions));
app.use(morgan('combined'));

// JWT Authentication Middleware (exclude extension-check and health endpoints)
app.use('/api/token', authenticateRequest);
app.use('/api/check-url', authenticateRequest);
app.use('/api/risk-details', authenticateRequest);
app.use('/api/feedback', authenticateRequest);
app.use('/api/stats', authenticateRequest);

// Enhanced rate limiting per authenticated user
const limiter = createAuthenticatedRateLimit({ 
  windowMs: 60 * 1000, 
  max: 60 // 60 req/min per authenticated user
});

app.use('/api/', limiter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Token generation endpoint for extension authentication
app.post('/api/token', async (req, res) => {
  try {
    const { apiKey, extensionId } = req.body || {};
    
    if (!apiKey || !extensionId) {
      return res.status(400).json({
        error: 'missing_credentials',
        message: 'API key and extension ID are required'
      });
    }
    
    const expectedApiKey = process.env.SAFEEXTENSION_API_KEY;
    const expectedExtensionId = process.env.CHROME_EXTENSION_ID;
    
    // Validate credentials
    if (apiKey !== expectedApiKey || extensionId !== expectedExtensionId) {
      logger.warn({ 
        ip: req.ip,
        extensionId,
        apiKeyProvided: !!apiKey
      }, 'Token generation failed - invalid credentials');
      
      return res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid API key or extension ID'
      });
    }
    
    // Generate JWT token
    const { generateExtensionToken } = await import('./auth.js');
    const token = generateExtensionToken(extensionId, apiKey);
    
    logger.info({ extensionId }, 'JWT token generated successfully');
    
    return res.json({
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      tokenType: 'Bearer'
    });
    
  } catch (error) {
    logger.error({ error: error.message }, 'Token generation failed');
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to generate token'
    });
  }
});

// Shared result builder for check-url
function responseFromFactors(url, basicFactors, advancedFactors, extra) {
  const weighted = computeWeightedScore(basicFactors, advancedFactors);
  const action = classify(weighted.score);

  return {
    url,
    action,
    score: weighted.score,
    risk_level: weighted.riskCategory ? weighted.riskCategory.toLowerCase() : 'unknown',
    reasons: weighted.reasons,
    confidence: weighted.confidence,
    details: {
      ...extra,
      basicFactors,
      advancedFactors
    }
  };
}

async function checkRedirects(url) {
  try {
    // Validate URL before making requests
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { count: 0, excessive: false, chain: [], suspicious: false };
    }

    const res = await fetch(url, { method: 'GET', redirect: 'manual' });
    let redirects = 0;
    let location = res.headers.get('location');
    let currentUrl = url;
    const redirectChain = [];

    while (location && redirects < 10) {
      redirects++;
      
      // Validate redirect URL
      try {
        const nextUrl = new URL(location, currentUrl).toString();
        
        // Only follow HTTP/HTTPS URLs
        if (!nextUrl.startsWith('http://') && !nextUrl.startsWith('https://')) {
          break;
        }
        
        redirectChain.push({ from: currentUrl, to: nextUrl, step: redirects });

        const r = await fetch(nextUrl, { method: 'GET', redirect: 'manual' });
        location = r.headers.get('location');
        currentUrl = nextUrl;
      } catch (urlError) {
        // Break on invalid URL construction
        break;
      }
    }

    return {
      count: redirects,
      excessive: redirects > 3,
      chain: redirectChain,
      suspicious: redirectChain.some(r => r.to.includes('bit.ly') || r.to.includes('tinyurl'))
    };
  } catch (err) {
    logger.warn({ err: String(err) }, 'Redirect check failed');
    return { count: 0, excessive: false, chain: [], suspicious: false };
  }
}

// Extension proxy endpoint (no authentication required for security)
app.post('/api/extension-check', async (req, res) => {
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
      logger.info({ url: normalizedUrl, cached: true }, 'extension_check_cached');
      return res.json(cached);
    }

    // Parse URL components
    const syntax = analyzeUrlSyntax(normalizedUrl);
    if (!syntax.hostname) {
      return res.status(400).json({
        error: 'invalid_url',
        message: 'Could not parse URL'
      });
    }

    // NEW: Use refactored evaluation with rule engine
    const evaluation = await evaluateURL(normalizedUrl, syntax.hostname);

    const result = {
      url: normalizedUrl,
      action: evaluation.action,
      score: evaluation.score,
      risk_level: evaluation.riskLevel,
      reasons: evaluation.reasons,
      confidence: Math.round(evaluation.confidence),
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, result);
    logger.info({ 
      url: normalizedUrl, 
      action: result.action, 
      score: result.score,
      riskLevel: result.risk_level
    }, 'extension_check_decision');
    
    return res.json(result);
  } catch (err) {
    logger.error({ err: String(err), stack: err.stack }, 'extension_check_error');
    return res.status(500).json({ 
      error: 'internal_error',
      message: 'An error occurred while checking the URL'
    });
  }
});

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

    // Basic analysis
    const syntax = analyzeUrlSyntax(normalizedUrl);
    const basicFactors = {
      noHttps: syntax.protocol !== 'https',
      suspiciousKeywords: hasSuspiciousKeywords(normalizedUrl),
      adultContent: hasAdultContent(normalizedUrl),
      ipObfuscation: isIpObfuscation(syntax.hostname),
      temporaryService: isTemporaryService(syntax.hostname),
      suspiciousSubdomain: hasSuspiciousSubdomain(syntax.hostname)
    };

    // Advanced analysis (parallel execution)
    const [sb, domainAgeDays, redirects, brandImpersonation, geographicRisk, certificate, reputation] = await Promise.all([
      checkSafeBrowsing(normalizedUrl),
      getDomainAgeDays(normalizedUrl),
      checkRedirects(normalizedUrl),
      detectBrandImpersonation(syntax.hostname),
      getGeographicRisk(syntax.hostname),
      analyzeCertificate(syntax.hostname),
      getReputationScore(syntax.domain)
    ]);

    // Complete basic factors
    basicFactors.youngDomain = (domainAgeDays !== null) ? domainAgeDays < 180 : false;
    basicFactors.listedInFeeds = !!sb.listed;
    basicFactors.excessiveRedirects = redirects.excessive;

    // Advanced factors
    const advancedFactors = {
      brandImpersonation,
      geographicRisk,
      certificate,
      reputation,
      urlStructure: analyzeURLStructure(syntax.hostname),
      suspiciousTLD: hasSuspiciousTLD(syntax.hostname)
    };

    const result = responseFromFactors(normalizedUrl, basicFactors, advancedFactors, {
      domainAgeDays,
      safeBrowsing: sb,
      redirects: redirects.count,
      redirectChain: redirects.chain || []
    });

    cache.set(cacheKey, result);
    logger.info({ url: normalizedUrl, action: result.action, score: result.score }, 'decision');
    return res.json(result);
  } catch (err) {
    logger.error({ err: String(err), stack: err.stack }, 'check_url_error');
    const response = {
      error: 'internal_error',
      message: 'An error occurred while checking the URL'
    };
        return res.status(500).json(response);
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
    
    // Fallback: compute on-demand identical to /check-url with advanced features
    const syntax = analyzeUrlSyntax(normalizedUrl);
    const basicFactors = {
      noHttps: syntax.protocol !== 'https',
      suspiciousKeywords: hasSuspiciousKeywords(normalizedUrl),
      adultContent: hasAdultContent(normalizedUrl),
      ipObfuscation: isIpObfuscation(syntax.hostname),
      temporaryService: isTemporaryService(syntax.hostname),
      suspiciousSubdomain: hasSuspiciousSubdomain(syntax.hostname)
    };

    // Advanced analysis (parallel execution)
    const [sb, domainAgeDays, redirects, brandImpersonation, geographicRisk, certificate, reputation] = await Promise.all([
      checkSafeBrowsing(normalizedUrl),
      getDomainAgeDays(normalizedUrl),
      checkRedirects(normalizedUrl),
      detectBrandImpersonation(syntax.hostname),
      getGeographicRisk(syntax.hostname),
      analyzeCertificate(syntax.hostname),
      getReputationScore(syntax.domain)
    ]);

    // Complete basic factors
    basicFactors.youngDomain = (domainAgeDays !== null) ? domainAgeDays < 180 : false;
    basicFactors.listedInFeeds = !!sb.listed;
    basicFactors.excessiveRedirects = redirects.excessive;

    // Advanced factors
    const advancedFactors = {
      brandImpersonation,
      geographicRisk,
      certificate,
      reputation,
      urlStructure: analyzeURLStructure(syntax.hostname),
      suspiciousTLD: hasSuspiciousTLD(syntax.hostname)
    };

    const result = responseFromFactors(normalizedUrl, basicFactors, advancedFactors, {
      domainAgeDays,
      safeBrowsing: sb,
      redirects: redirects.count,
      redirectChain: redirects.chain || []
    });

    cache.set(cacheKey, result);
    return res.json(result);
  } catch (err) {
    logger.error({ err: String(err), stack: err.stack }, 'risk_details_error');
    const response = {
      error: 'internal_error',
      message: 'An error occurred while analyzing the URL'
    };
        return res.status(500).json(response);
  }
});

// Feedback submission endpoint
app.post('/api/feedback', async (req, res) => {
  try {
    const { url, type, userId, comment } = req.body || {};
    
    if (!url || !type || !userId) {
      return res.status(400).json({
        error: 'missing_fields',
        message: 'URL, type, and userId are required'
      });
    }
    
    if (!['false_positive', 'confirmed_threat', 'user_blocked', 'user_allowed'].includes(type)) {
      return res.status(400).json({
        error: 'invalid_type',
        message: 'Invalid feedback type'
      });
    }
    
    // Simple feedback storage (in production, use database)
    const feedback = {
      url: url.toLowerCase(),
      type,
      userId,
      comment: comment || '',
      timestamp: new Date().toISOString()
    };
    
    logger.info({ url, type, userId }, 'Feedback submitted');
    
    return res.json({
      success: true,
      message: 'Feedback recorded successfully',
      feedback
    });
    
  } catch (err) {
    logger.error({ err: String(err) }, 'Feedback submission failed');
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to submit feedback'
    });
  }
});

// Community feedback endpoint
app.get('/api/feedback/:url', async (req, res) => {
  try {
    const { url } = req.params;
    
    if (!url) {
      return res.status(400).json({
        error: 'url_required',
        message: 'URL parameter is required'
      });
    }
    
    // Simplified community score (in production, use actual database)
    const communityScore = {
      score: 75, // Mock score
      confidence: 85,
      totalReports: 12,
      breakdown: {
        threats: 3,
        falsePositives: 2,
        userBlocks: 5,
        userAllows: 2
      }
    };
    
    return res.json({
      url,
      communityScore,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    logger.error({ err: String(err) }, 'Feedback retrieval failed');
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to retrieve feedback'
    });
  }
});

// Statistics endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const stats = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cache: {
        size: cache.size || 0,
        hits: cache.hits || 0,
        misses: cache.misses || 0
      },
      version: 'advanced',
      timestamp: new Date().toISOString()
    };
    
    return res.json(stats);
    
  } catch (err) {
    logger.error({ err: String(err) }, 'Stats retrieval failed');
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to retrieve statistics'
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
