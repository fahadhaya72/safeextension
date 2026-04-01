// Advanced Scoring Algorithm - No ML Required
// Sophisticated rule-based system for professional-level security

import { parse } from 'tldts';
import fetch from 'node-fetch';

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

// Advanced pattern detection
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
  const checks = await Promise.allSettled([
    checkSearchEnginePresence(domain),
    checkDomainHistory(domain),
    checkSocialMediaPresence(domain)
  ]);
  
  let reputationScore = 50; // Base score
  const details = {};
  
  // Search engine presence
  if (checks[0].status === 'fulfilled') {
    details.searchPresence = checks[0].value;
    if (checks[0].value.indexed) {
      reputationScore += 20;
    }
  }
  
  // Domain history
  if (checks[1].status === 'fulfilled') {
    details.domainHistory = checks[1].value;
    if (checks[1].value.consistent) {
      reputationScore += 15;
    }
  }
  
  // Social media presence
  if (checks[2].status === 'fulfilled') {
    details.socialPresence = checks[2].value;
    if (checks[2].value.verified) {
      reputationScore += 25;
    }
  }
  
  return {
    score: Math.min(100, Math.max(0, reputationScore)),
    level: reputationScore >= 80 ? 'high' : reputationScore >= 60 ? 'medium' : 'low',
    details
  };
}

// Helper functions (simplified implementations)
async function checkSearchEnginePresence(domain) {
  // Simplified - would use actual search APIs in production
  return { indexed: true, results: 1000 };
}

async function checkDomainHistory(domain) {
  // Simplified - would use Wayback Machine API
  return { consistent: true, firstSeen: '2020-01-01' };
}

async function checkSocialMediaPresence(domain) {
  // Simplified - would check social media APIs
  return { verified: false, profiles: [] };
}

// Enhanced scoring computation
export function computeAdvancedScore(basicFactors, advancedFactors) {
  let deductions = 0;
  const reasons = [];
  
  // Include basic factors
  if (basicFactors.noHttps) { deductions += 20; reasons.push({ code: 'NO_HTTPS', points: 20 }); }
  if (basicFactors.youngDomain) { deductions += 25; reasons.push({ code: 'YOUNG_DOMAIN', points: 25 }); }
  if (basicFactors.listedInFeeds) { deductions += 50; reasons.push({ code: 'LISTED_IN_FEEDS', points: 50 }); }
  if (basicFactors.suspiciousKeywords) { deductions += 15; reasons.push({ code: 'SUSPICIOUS_KEYWORDS', points: 15 }); }
  if (basicFactors.excessiveRedirects) { deductions += 10; reasons.push({ code: 'EXCESSIVE_REDIRECTS', points: 10 }); }
  if (basicFactors.ipObfuscation) { deductions += 40; reasons.push({ code: 'IP_OBFUSCATION', points: 40 }); }
  if (basicFactors.temporaryService) { deductions += 30; reasons.push({ code: 'TEMPORARY_SERVICE', points: 30 }); }
  if (basicFactors.suspiciousSubdomain) { deductions += 20; reasons.push({ code: 'SUSPICIOUS_SUBDOMAIN', points: 20 }); }
  
  // Add advanced factors
  if (advancedFactors.brandImpersonation?.detected) {
    const points = Math.round(45 * (advancedFactors.brandImpersonation.confidence / 100));
    deductions += points;
    reasons.push({ code: 'BRAND_IMPERSONATION', points, brand: advancedFactors.brandImpersonation.brand });
  }
  
  if (advancedFactors.suspiciousTLD) {
    deductions += 20;
    reasons.push({ code: 'SUSPICIOUS_TLD', points: 20 });
  }
  
  if (advancedFactors.urlStructure?.score > 0) {
    deductions += advancedFactors.urlStructure.score;
    reasons.push({ code: 'SUSPICIOUS_STRUCTURE', points: advancedFactors.urlStructure.score });
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
    const points = 60 - advancedFactors.reputation.score;
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
