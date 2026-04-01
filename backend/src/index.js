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
  analyzeUrlSyntax, 
  computeScore, 
  classify, 
  hasSuspiciousKeywords, 
  isValidUrl, 
  isIpObfuscation, 
  isTemporaryService, 
  hasSuspiciousSubdomain,
  computeAdvancedScore,
  detectBrandImpersonation,
  hasSuspiciousTLD,
  analyzeURLStructure,
  getGeographicRisk,
  analyzeCertificate,
  getReputationScore
} from './scoring.js';
import { checkSafeBrowsing } from './services/safebrowsing.js';
import { getDomainAgeDays } from './services/whois.js';

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
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
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

// API Authentication Middleware
app.use('/api/', (req, res, next) => {
  // Skip authentication for health check
  if (req.path === '/health') return next();
  
  const providedKey = req.headers['x-api-key'];
  const providedExtensionId = req.headers['x-extension-id'];
  
  // Check API key
  if (!API_KEY || providedKey !== API_KEY) {
    logger.warn({ ip: req.ip, userAgent: req.get('User-Agent') }, 'Unauthorized API access attempt');
    return res.status(401).json({ 
      error: 'unauthorized',
      message: 'Valid API key required' 
    });
  }
  
  // Check extension ID (if configured)
  if (EXTENSION_ID && providedExtensionId !== EXTENSION_ID) {
    logger.warn({ ip: req.ip, extensionId: providedExtensionId }, 'Invalid extension ID');
    return res.status(403).json({ 
      error: 'forbidden',
      message: 'Invalid extension ID' 
    });
  }
  
  next();
});

// Enhanced rate limiting per API key
const limiter = rateLimit({ 
  windowMs: 60 * 1000, 
  max: 30, // Reduced from 60 to 30 for security
  message: { 
    error: 'rate_limit_exceeded', 
    message: 'Too many requests, please try again later' 
  },
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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

function responseFromFactors(url, basicFactors, advancedFactors, extra) {
  const { score, classification, reasons } = computeAdvancedScore(basicFactors, advancedFactors);
  const action = classify(score);
  return {
    url,
    score,
    action,
    risk_classification: classification,
    risk_factors: reasons,
    details: {
      ...extra,
      advanced: {
        brandImpersonation: advancedFactors.brandImpersonation,
        geographicRisk: advancedFactors.geographicRisk,
        reputation: advancedFactors.reputation,
        certificate: advancedFactors.certificate,
        urlStructure: advancedFactors.urlStructure
      }
    },
    metadata: {
      analysis_version: 'advanced',
      timestamp: new Date().toISOString(),
      confidence: calculateConfidence(score, reasons.length)
    }
  };
}

// Calculate confidence score
function calculateConfidence(score, factorCount) {
  let confidence = 50; // Base confidence
  
  // Higher confidence for extreme scores
  if (score < 20 || score > 90) confidence += 20;
  else if (score < 40 || score > 80) confidence += 10;
  
  // More factors = higher confidence
  confidence += Math.min(30, factorCount * 3);
  
  return Math.min(100, Math.round(confidence));
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

    // Basic analysis
    const syntax = analyzeUrlSyntax(normalizedUrl);
    const basicFactors = {
      noHttps: syntax.protocol !== 'https',
      suspiciousKeywords: hasSuspiciousKeywords(normalizedUrl),
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
    
    // Fallback: compute on-demand identical to /check-url with advanced features
    const syntax = analyzeUrlSyntax(normalizedUrl);
    const basicFactors = {
      noHttps: syntax.protocol !== 'https',
      suspiciousKeywords: hasSuspiciousKeywords(normalizedUrl),
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
    return res.status(500).json({ 
      error: 'internal_error',
      message: 'An error occurred while analyzing the URL'
    });
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
