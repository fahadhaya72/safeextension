// Advanced SafeExtension Backend - Professional-Level Security (No ML Required)
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
  hasSuspiciousSubdomain 
} from './scoring.js';
import { 
  computeAdvancedScore,
  detectBrandImpersonation,
  hasSuspiciousTLD,
  analyzeURLStructure,
  getGeographicRisk,
  analyzeCertificate,
  getReputationScore
} from './advanced-scoring.js';
import { checkSafeBrowsing } from './services/safebrowsing.js';
import { getDomainAgeDays } from './services/whois.js';
import { 
  submitFeedback, 
  getCommunityScore, 
  getFeedbackSummary,
  analyzeFeedbackPatterns 
} from './feedback.js';

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const MAX_URL_LENGTH = 2048;

// Security middleware
app.use(helmet());
app.use(express.json());
app.use(cors({ origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN }));
app.use(morgan('combined'));

// Advanced rate limiting
const limiter = rateLimit({ 
  windowMs: 60 * 1000, 
  max: 60,
  message: { error: 'rate_limit_exceeded', message: 'Too many requests' }
});
app.use('/api/', limiter);

app.get('/api/health', (_req, res) => res.json({ ok: true, version: 'advanced' }));

// Advanced redirect checking
async function checkRedirects(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual' });
    let redirects = 0;
    let location = res.headers.get('location');
    let currentUrl = url;
    let redirectChain = [];
    
    while (location && redirects < 10) {
      redirects++;
      const nextUrl = new URL(location, currentUrl).toString();
      redirectChain.push({
        from: currentUrl,
        to: nextUrl,
        step: redirects
      });
      
      const r = await fetch(nextUrl, { method: 'GET', redirect: 'manual' });
      location = r.headers.get('location');
      currentUrl = nextUrl;
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

// Enhanced response builder
function buildAdvancedResponse(url, basicFactors, advancedFactors, extra) {
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
        urlStructure: advancedFactors.urlStructure,
        communityScore: advancedFactors.communityScore
      }
    },
    metadata: {
      analysis_version: 'advanced',
      timestamp: new Date().toISOString(),
      confidence: calculateConfidence(score, reasons.length, advancedFactors.communityScore?.confidence || 0)
    }
  };
}

// Calculate confidence score
function calculateConfidence(score, factorCount, communityConfidence) {
  let confidence = 50; // Base confidence
  
  // Higher confidence for extreme scores
  if (score < 20 || score > 90) confidence += 20;
  else if (score < 40 || score > 80) confidence += 10;
  
  // More factors = higher confidence
  confidence += Math.min(30, factorCount * 3);
  
  // Community feedback boosts confidence
  confidence += communityConfidence * 0.2;
  
  return Math.min(100, Math.round(confidence));
}

// Advanced URL analysis endpoint
app.post('/api/check-url', async (req, res) => {
  try {
    const { url, useAdvanced = true, userId } = req.body || {};
    
    // Enhanced validation
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
    const cacheKey = `advanced:${normalizedUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.info({ url: normalizedUrl, cached: true }, 'Advanced URL check cached');
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
    const [sb, domainAgeDays, redirects, brandImpersonation, geographicRisk, certificate, reputation, communityScore] = await Promise.all([
      checkSafeBrowsing(normalizedUrl),
      getDomainAgeDays(normalizedUrl),
      checkRedirects(normalizedUrl),
      detectBrandImpersonation(syntax.hostname),
      getGeographicRisk(syntax.hostname),
      analyzeCertificate(syntax.hostname),
      getReputationScore(syntax.domain),
      getCommunityScore(normalizedUrl)
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
      suspiciousTLD: hasSuspiciousTLD(syntax.hostname),
      communityScore
    };

    const result = buildAdvancedResponse(normalizedUrl, basicFactors, advancedFactors, {
      domainAgeDays,
      safeBrowsing: sb,
      redirects: redirects.count,
      redirectChain: redirects.chain
    });

    // Cache for 15 minutes
    cache.set(cacheKey, result, 900);
    
    logger.info({ 
      url: normalizedUrl, 
      action: result.action, 
      score: result.score,
      confidence: result.metadata.confidence,
      advanced: useAdvanced 
    }, 'Advanced URL analysis completed');
    
    return res.json(result);
    
  } catch (err) {
    logger.error({ err: String(err), stack: err.stack }, 'Advanced URL check failed');
    return res.status(500).json({ 
      error: 'internal_error',
      message: 'An error occurred while checking the URL'
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
    
    const result = await submitFeedback(url, type, userId, comment);
    
    if (result.success) {
      // Clear cache to force fresh analysis with new feedback
      const cacheKey = `advanced:${url.toLowerCase()}`;
      cache.delete(cacheKey);
    }
    
    return res.json(result);
    
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
    
    const [summary, patterns, communityScore] = await Promise.all([
      getFeedbackSummary(url),
      analyzeFeedbackPatterns(url),
      getCommunityScore(url)
    ]);
    
    return res.json({
      url,
      communityScore,
      summary,
      patterns,
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

// Advanced risk details endpoint
app.post('/api/risk-details', async (req, res) => {
  try {
    const { url, userId } = req.body || {};
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        error: 'url_required',
        message: 'URL parameter is required and must be a string'
      });
    }

    // Reuse the advanced check logic
    req.body.useAdvanced = true;
    return app._router.handle(req, res);
    
  } catch (err) {
    logger.error({ err: String(err) }, 'Risk details failed');
    return res.status(500).json({ 
      error: 'internal_error',
      message: 'Failed to analyze URL risk details'
    });
  }
});

// User verification endpoint
app.post('/api/user/verify', async (req, res) => {
  try {
    const { userId, trusted = true } = req.body || {};
    
    if (!userId) {
      return res.status(400).json({
        error: 'user_id_required',
        message: 'User ID is required'
      });
    }
    
    await verifyUser(userId, trusted);
    
    return res.json({
      success: true,
      message: 'User verification status updated',
      userId,
      verified: trusted
    });
    
  } catch (err) {
    logger.error({ err: String(err) }, 'User verification failed');
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to verify user'
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
        size: cache.size,
        hits: cache.hits,
        misses: cache.misses
      },
      feedback: {
        totalReports: Array.from(feedbackStore.values()).reduce((sum, reports) => sum + reports.length, 0),
        uniqueUrls: feedbackStore.size
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
  logger.info({ port: PORT, version: 'advanced' }, 'SafeExtension Advanced Backend listening');
});

// Enhanced error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error: String(error), stack: error.stack }, 'Uncaught Exception');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
