// Advanced Scoring Algorithm - Professional-Level Security (No ML Required)
// Base score = 100
// Deductions:
// - No HTTPS → −20
// - Domain age < 6 months → −25
// - Domain looks like IP obfuscation (e.g., 125.0.0.1.com) → −40
// - Listed in phishing/malware feeds → −50
// - Suspicious URL keywords → −15
// - Excessive redirects (>3) → −10
// - Temporary/tunnel services → −30
// - Suspicious subdomains → −20
// - Brand impersonation → −45 (weighted by confidence)
// - Suspicious TLD → −20
// - Geographic risk → −15/25
// - Certificate issues → −10/30
// - Low reputation → −0/40
// Final score = 100 − total deductions, clamped to [0, 100]

import { parse } from 'tldts';

// Advanced brand impersonation detection
const BRAND_PATTERNS = {
  google: [
    /googl[e|3|l|e|0].com/gi,
    /g[o|0][o|0]gl[e|3|l|e|0].com/gi,
    /googl[e|3|l|e|0]\.net/gi,
    /g[o|0][o|0]gl[e|3|l|e|0]\.org/gi
  ],
  amazon: [
    /amaz[o|0]n.com/gi,
    /amaz[o|0]n\.[a-z]{2,3}/gi,
    /amzn\.to/gi
  ],
  facebook: [
    /fac[e|3|b]ook.com/gi,
    /fb\.com/gi,
    /faceb[o|0][o|0]k.com/gi
  ],
  paypal: [
    /paypa[l|1].com/gi,
    /paypa[l|1]\.[a-z]{2,3}/gi,
    /paypal\.me/gi
  ]
};

// Suspicious TLDs commonly used for phishing
const SUSPICIOUS_TLDS = [
  '.tk', '.ml', '.ga', '.cf', '.gq', '.men', '.click', '.download',
  '.loan', '.racing', '.win', '.party', '.trade', '.webcam', '.date'
];

// High-risk geographic regions
const HIGH_RISK_COUNTRIES = ['CN', 'RU', 'KP', 'IR', 'NG', 'PK', 'BD'];
const MEDIUM_RISK_COUNTRIES = ['ID', 'PH', 'VN', 'TH', 'MY', 'UA'];

const SUSPICIOUS_KEYWORDS = [
  'login', 'verify', 'update', 'secure', 'bank', 'account', 'paypal', 'free', 'bonus', 'win', 'prize',
  'secrets', 'secret', 'vista', 'distances', 'partial', 'cloudflare', 'trycloudflare',
  'temp', 'temporary', 'test', 'dev', 'staging', 'admin', 'panel', 'dashboard',
  'download', 'install', 'setup', 'activate', 'confirm', 'verification', 'auth',
  'password', 'credential', 'token', 'key', 'access', 'unlocked', 'restricted'
];

export function isValidUrl(url) {
  try {
    const u = new URL(url);
    // Check for valid protocols (http, https, ftp, etc.)
    return /^https?:/.test(u.protocol);
  } catch {
    return false;
  }
}

export function analyzeUrlSyntax(url) {
  try {
    const u = new URL(url);
    return {
      protocol: u.protocol.replace(':',''),
      hostname: u.hostname,
      path: u.pathname + (u.search || '')
    };
  } catch {
    return { protocol: null, hostname: null, path: null };
  }
}

// Detect if domain looks like IP obfuscation (e.g., 125.0.0.1.com, 192.168.1.1.example.com)
export function isIpObfuscation(hostname) {
  if (!hostname) return false;
  // Match patterns like "X.X.X.X.something" or "something.X.X.X.X"
  const ipPattern = /(\d{1,3}\.){3}\d{1,3}/;
  return ipPattern.test(hostname);
}

// Detect suspicious temporary/tunnel services
export function isTemporaryService(hostname) {
  if (!hostname) return false;
  const tempServices = [
    'trycloudflare.com', 'cloudflare-ip.com', 'ngrok.io', 'ngrok-free.app',
    'serveo.net', 'localtunnel.me', 'pagekite.me', 'tunnelto.dev',
    'localho.st', 'xip.io', 'nip.io', 'sslip.io'
  ];
  return tempServices.some(service => hostname.includes(service));
}

// Detect suspiciously long or random subdomains
export function hasSuspiciousSubdomain(hostname) {
  if (!hostname) return false;
  const parts = hostname.split('.');
  // Check if subdomain is unusually long or has random-looking patterns
  const subdomain = parts.length > 2 ? parts[0] : '';
  if (subdomain.length > 20) return true;
  
  // Check for random-looking patterns (multiple hyphens, random words)
  const randomPattern = /^[a-z]+(-[a-z]+){2,}$/;
  return randomPattern.test(subdomain) && subdomain.split('-').length >= 3;
}

// Advanced brand impersonation detection
export function detectBrandImpersonation(hostname) {
  if (!hostname) return { detected: false, brand: null, confidence: 0 };
  
  const lowerHostname = hostname.toLowerCase();
  
  for (const [brand, patterns] of Object.entries(BRAND_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerHostname)) {
        // Calculate confidence based on similarity
        const confidence = calculateSimilarityConfidence(lowerHostname, brand);
        return { detected: true, brand, confidence };
      }
    }
  }
  
  return { detected: false, brand: null, confidence: 0 };
}

// Calculate visual similarity confidence
function calculateSimilarityConfidence(hostname, brand) {
  const levenshteinDistance = calculateLevenshtein(hostname, brand);
  const maxLength = Math.max(hostname.length, brand.length);
  const similarity = 1 - (levenshteinDistance / maxLength);
  
  return Math.round(similarity * 100);
}

// Simple Levenshtein distance calculation
function calculateLevenshtein(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Suspicious TLD detection
export function hasSuspiciousTLD(hostname) {
  if (!hostname) return false;
  
  const { domain, publicSuffix } = parse(hostname);
  if (!domain || !publicSuffix) return false;
  
  const tld = '.' + publicSuffix;
  return SUSPICIOUS_TLDS.includes(tld);
}

// URL structure analysis
export function analyzeURLStructure(hostname) {
  if (!hostname) return { issues: [], score: 0 };
  
  const issues = [];
  let score = 0;
  
  // Too many subdomains
  const parts = hostname.split('.');
  if (parts.length > 4) {
    issues.push('too_many_subdomains');
    score += 15;
  }
  
  // Suspicious character encoding
  if (/%[0-9A-Fa-f]{2}/.test(hostname)) {
    issues.push('encoded_characters');
    score += 20;
  }
  
  // Excessive hyphens
  const hyphenCount = (hostname.match(/-/g) || []).length;
  if (hyphenCount > 3) {
    issues.push('excessive_hyphens');
    score += 10;
  }
  
  // Numeric-heavy domains
  const numericRatio = (hostname.match(/\d/g) || []).length / hostname.length;
  if (numericRatio > 0.3) {
    issues.push('numeric_heavy');
    score += 15;
  }
  
  return { issues, score };
}

// Geographic risk assessment
export async function getGeographicRisk(hostname) {
  try {
    // Get IP address for hostname
    const ipResponse = await fetch(`https://dns.google/resolve?name=${hostname}&type=A`);
    const ipData = await ipResponse.json();
    
    if (!ipData.Answer || ipData.Answer.length === 0) {
      return { risk: 'unknown', country: null, reason: 'dns_resolution_failed' };
    }
    
    const ip = ipData.Answer[0].data;
    
    // Get geographic information
    const geoResponse = await fetch(`http://ip-api.com/json/${ip}`);
    const geoData = await geoResponse.json();
    
    if (geoData.status !== 'success') {
      return { risk: 'unknown', country: null, reason: 'geo_lookup_failed' };
    }
    
    const country = geoData.countryCode;
    let risk = 'low';
    let score = 0;
    
    if (HIGH_RISK_COUNTRIES.includes(country)) {
      risk = 'high';
      score = 25;
    } else if (MEDIUM_RISK_COUNTRIES.includes(country)) {
      risk = 'medium';
      score = 15;
    }
    
    return {
      risk,
      country,
      score,
      details: {
        isp: geoData.isp,
        org: geoData.org,
        isDatacenter: geoData.org?.toLowerCase().includes('datacenter')
      }
    };
    
  } catch (error) {
    return { risk: 'unknown', country: null, reason: 'lookup_error', error: error.message };
  }
}

// Certificate analysis (simplified version)
export async function analyzeCertificate(hostname) {
  try {
    // This would require SSL certificate parsing in production
    // For now, we'll simulate with basic checks
    
    const issues = [];
    let score = 0;
    
    // Check if it's a common phishing pattern
    if (hostname.includes('ssl') || hostname.includes('secure')) {
      issues.push('suspicious_ssl_keywords');
      score += 10;
    }
    
    // Check for common certificate-related phishing domains
    const certSuspiciousPatterns = [
      /ssl.*certificate/i,
      /secure.*connection/i,
      /verified.*site/i
    ];
    
    for (const pattern of certSuspiciousPatterns) {
      if (pattern.test(hostname)) {
        issues.push('certificate_impersonation');
        score += 20;
        break;
      }
    }
    
    return {
      valid: true, // Would be actual certificate validation
      issues,
      score,
      trustLevel: score > 0 ? 'low' : 'high'
    };
    
  } catch (error) {
    return {
      valid: false,
      issues: ['certificate_check_failed'],
      score: 30,
      trustLevel: 'very_low',
      error: error.message
    };
  }
}

// Reputation scoring
export async function getReputationScore(domain) {
  try {
    // Simplified reputation checks
    let reputationScore = 50; // Base score
    const details = {};
    
    // Search engine presence (simulated)
    const searchPresence = await checkSearchEnginePresence(domain);
    details.searchPresence = searchPresence;
    if (searchPresence.indexed) {
      reputationScore += 20;
    }
    
    // Domain history (simulated)
    const domainHistory = await checkDomainHistory(domain);
    details.domainHistory = domainHistory;
    if (domainHistory.consistent) {
      reputationScore += 15;
    }
    
    // Social media presence (simulated)
    const socialPresence = await checkSocialMediaPresence(domain);
    details.socialPresence = socialPresence;
    if (socialPresence.verified) {
      reputationScore += 25;
    }
    
    return {
      score: Math.min(100, Math.max(0, reputationScore)),
      level: reputationScore >= 80 ? 'high' : reputationScore >= 60 ? 'medium' : 'low',
      details
    };
  } catch (error) {
    return {
      score: 50,
      level: 'medium',
      details: { error: error.message }
    };
  }
}

// Helper functions (simplified implementations)
async function checkSearchEnginePresence(domain) {
  // Simplified - would use actual search APIs in production
  return { indexed: Math.random() > 0.3, results: Math.floor(Math.random() * 10000) };
}

async function checkDomainHistory(domain) {
  // Simplified - would use Wayback Machine API
  return { consistent: Math.random() > 0.2, firstSeen: '2020-01-01' };
}

async function checkSocialMediaPresence(domain) {
  // Simplified - would check social media APIs
  return { verified: Math.random() > 0.7, profiles: [] };
}

export function computeScore(factors) {
  let deductions = 0;
  const reasons = [];

  if (factors.noHttps) { deductions += 20; reasons.push({ code: 'NO_HTTPS', points: 20 }); }
  if (factors.youngDomain) { deductions += 25; reasons.push({ code: 'YOUNG_DOMAIN', points: 25 }); }
  if (factors.ipObfuscation) { deductions += 40; reasons.push({ code: 'IP_OBFUSCATION', points: 40 }); }
  if (factors.listedInFeeds) { deductions += 50; reasons.push({ code: 'LISTED_IN_FEEDS', points: 50 }); }
  if (factors.suspiciousKeywords) { deductions += 15; reasons.push({ code: 'SUSPICIOUS_KEYWORDS', points: 15 }); }
  if (factors.excessiveRedirects) { deductions += 10; reasons.push({ code: 'EXCESSIVE_REDIRECTS', points: 10 }); }
  if (factors.temporaryService) { deductions += 30; reasons.push({ code: 'TEMPORARY_SERVICE', points: 30 }); }
  if (factors.suspiciousSubdomain) { deductions += 20; reasons.push({ code: 'SUSPICIOUS_SUBDOMAIN', points: 20 }); }

  const score = Math.max(0, Math.min(100, 100 - deductions));
  let classification = 'safe';
  if (score < 40) classification = 'danger';
  else if (score < 50) classification = 'high_alert';
  else if (score < 90) classification = 'warning';
  else classification = 'safe';

  return { score, classification, reasons };
}

// Enhanced scoring computation
export function computeAdvancedScore(basicFactors, advancedFactors) {
  let deductions = 0;
  const reasons = [];
  
  // Include basic factors (reduced weights for better accuracy)
  if (basicFactors.noHttps) { deductions += 15; reasons.push({ code: 'NO_HTTPS', points: 15 }); }
  if (basicFactors.youngDomain) { deductions += 20; reasons.push({ code: 'YOUNG_DOMAIN', points: 20 }); }
  if (basicFactors.listedInFeeds) { deductions += 50; reasons.push({ code: 'LISTED_IN_FEEDS', points: 50 }); }
  if (basicFactors.suspiciousKeywords) { deductions += 12; reasons.push({ code: 'SUSPICIOUS_KEYWORDS', points: 12 }); }
  if (basicFactors.excessiveRedirects) { deductions += 8; reasons.push({ code: 'EXCESSIVE_REDIRECTS', points: 8 }); }
  if (basicFactors.ipObfuscation) { deductions += 35; reasons.push({ code: 'IP_OBFUSCATION', points: 35 }); }
  if (basicFactors.temporaryService) { deductions += 25; reasons.push({ code: 'TEMPORARY_SERVICE', points: 25 }); }
  if (basicFactors.suspiciousSubdomain) { deductions += 15; reasons.push({ code: 'SUSPICIOUS_SUBDOMAIN', points: 15 }); }
  
  // Add advanced factors (reduced weights)
  if (advancedFactors.brandImpersonation?.detected) {
    const points = Math.round(35 * (advancedFactors.brandImpersonation.confidence / 100));
    deductions += points;
    reasons.push({ code: 'BRAND_IMPERSONATION', points, brand: advancedFactors.brandImpersonation.brand });
  }
  
  if (advancedFactors.suspiciousTLD) {
    deductions += 15;
    reasons.push({ code: 'SUSPICIOUS_TLD', points: 15 });
  }
  
  if (advancedFactors.urlStructure?.score > 0) {
    deductions += Math.round(advancedFactors.urlStructure.score * 0.7);
    reasons.push({ code: 'SUSPICIOUS_STRUCTURE', points: Math.round(advancedFactors.urlStructure.score * 0.7) });
  }
  
  if (advancedFactors.geographicRisk?.score > 0) {
    deductions += advancedFactors.geographicRisk.score;
    reasons.push({ code: 'GEOGRAPHIC_RISK', points: advancedFactors.geographicRisk.score, country: advancedFactors.geographicRisk.country });
  }
  
  if (advancedFactors.certificate?.score > 0) {
    deductions += advancedFactors.certificate.score;
    reasons.push({ code: 'CERTIFICATE_ISSUES', points: advancedFactors.certificate.score });
  }
  
  if (advancedFactors.reputation?.score < 60) {
    const points = Math.round((60 - advancedFactors.reputation.score) * 0.5); // Reduced by 50%
    deductions += points;
    reasons.push({ code: 'LOW_REPUTATION', points, reputationScore: advancedFactors.reputation.score });
  }
  
  const score = Math.max(0, Math.min(100, 100 - deductions));
  
  // Advanced classification
  let classification = 'safe';
  if (score < 20) classification = 'critical';
  else if (score < 40) classification = 'danger';
  else if (score < 60) classification = 'high_alert';
  else if (score < 85) classification = 'warning';
  else classification = 'safe';
  
  return { score, classification, reasons };
}

export function classify(score) {
  // Updated 5-tier risk classification system:
  // Score ≥ 90: ALLOW (no warning)
  // Score 85-89: ALERT (show alert) 
  // Score 60-84: WARNING (show warning)
  // Score 40-59: HIGH ALERT (show warning)
  // Score < 40: BLOCK PERMANENTLY
  if (score >= 90) return 'allow';
  if (score >= 85) return 'alert';
  if (score >= 60) return 'warning';
  if (score >= 40) return 'high_alert';
  return 'block';
}

export function hasSuspiciousKeywords(url) {
  const lower = url.toLowerCase();
  return SUSPICIOUS_KEYWORDS.some(k => lower.includes(k));
}
