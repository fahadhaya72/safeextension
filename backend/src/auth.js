import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import logger from './logger.js';
import rateLimit from 'express-rate-limit';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Generate JWT token for extension
export function generateExtensionToken(extensionId, apiKey) {
  if (!extensionId || !apiKey) {
    throw new Error('Extension ID and API key are required');
  }
  
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const payload = {
    extensionId,
    apiKey: hashApiKey(apiKey),
    type: 'extension',
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256'
  });
}

// Verify JWT token
export function verifyToken(token) {
  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if token is still valid and not expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    logger.warn({ error: error.message }, 'JWT verification failed');
    return null;
  }
}

// Hash API key for storage
export function hashApiKey(apiKey) {
  return bcrypt.hashSync(apiKey, 10);
}

// Verify API key against hash
export function verifyApiKey(apiKey, hashedKey) {
  return bcrypt.compareSync(apiKey, hashedKey);
}

// Middleware to authenticate requests
export function authenticateRequest(req, res, next) {
  // Skip authentication for health check, extension-check, and check-url
  if (req.path === '/health' || req.path === '/extension-check' || req.path === '/check-url') {
    return next();
  }

  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];
  const extensionId = req.headers['x-extension-id'];

  // Try JWT authentication first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (decoded && decoded.type === 'extension') {
      // Verify the extension ID matches
      if (decoded.extensionId === extensionId) {
        req.auth = decoded;
        return next();
      }
    }
  }

  // Fallback to API key authentication
  const expectedApiKey = process.env.SAFEEXTENSION_API_KEY;
  const expectedExtensionId = process.env.CHROME_EXTENSION_ID;

  if (!expectedApiKey || apiKey !== expectedApiKey) {
    logger.warn({ 
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      providedApiKey: apiKey ? 'present' : 'missing'
    }, 'Unauthorized API access attempt');
    
    return res.status(401).json({ 
      error: 'unauthorized',
      message: 'Valid API key or token required' 
    });
  }

  // Check extension ID (if configured) - but allow web frontend
  if (expectedExtensionId && extensionId !== expectedExtensionId && extensionId !== 'web') {
    logger.warn({ 
      ip: req.ip, 
      extensionId,
      expectedExtensionId 
    }, 'Invalid extension ID');
    
    return res.status(403).json({ 
      error: 'forbidden',
      message: 'Invalid extension ID' 
    });
  }

  req.auth = { type: 'api_key', extensionId };
  next();
}

// Rate limiting middleware that considers authenticated users
export function createAuthenticatedRateLimit(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000, // 1 minute
    max: options.max || 60, // 60 requests per window
    message: { 
      error: 'rate_limit_exceeded', 
      message: 'Too many requests, please try again later' 
    },
    keyGenerator: (req) => {
      // Use extension ID for authenticated requests, IP for others
      if (req.auth && req.auth.extensionId) {
        return `ext:${req.auth.extensionId}`;
      }
      return req.ip;
    },
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  });
}
