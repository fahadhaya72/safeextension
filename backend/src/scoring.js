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
import logger from './logger.js';

// Advanced brand impersonation detection
const BRAND_PATTERNS = {
  google: [
    /googl[e3li0]\.com/gi,
    /g[o0][o0]gl[e3li0]\.com/gi,
    /googl[e3li0]\.net/gi,
    /g[o0][o0]gl[e3li0]\.org/gi
  ],
  amazon: [
    /amaz[o0]n\.com/gi,
    /amaz[o0]n\.[a-z]{2,3}/gi,
    /amzn\.to/gi
  ],
  facebook: [
    /fac[e3b]ook\.com/gi,
    /fb\.com/gi,
    /faceb[o0][o0]k\.com/gi
  ],
  paypal: [
    /paypa[l1]\.com/gi,
    /paypa[l1]\.[a-z]{2,3}/gi,
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

// Adult content keywords - should be blocked
const ADULT_CONTENT_KEYWORDS = [
  'porn', 'pornhub', 'xxx', 'sex', 'adult', 'nsfw', 'erotic', 'hentai', 'onlyfans',
  'playboy', 'xvideos', 'redtube', 'youporn', 'tube8', 'spankbang', 'eporner',
  'chaturbate', 'bongacams', 'stripchat', 'camsoda', 'livejasmin', 'flirt4free',
  'nude', 'naked', 'hardcore', 'softcore', 'fetish', 'bdsm', 'orgy', 'escort',
  'whore', 'slut', 'pussy', 'dick', 'cock', 'tits', 'boobs', 'ass', 'anal',
  'blowjob', 'handjob', 'masturbat', 'fuck', 'shit', 'cum', 'sperm', 'penis',
  'vagina', 'clit', 'breast', 'nipple', 'lesbian', 'gay', 'bisexual', 'threesome'
];

// Adult content domains - immediate block
const ADULT_CONTENT_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xhamster.com', 'youporn.com', 'redtube.com',
  'tube8.com', 'spankbang.com', 'eporner.com', 'chaturbate.com', 'bongacams.com',
  'stripchat.com', 'camsoda.com', 'livejasmin.com', 'flirt4free.com', 'onlyfans.com',
  'playboy.com', 'playboyplus.com', 'hentaihaven.com', 'nhentai.net', 'hentai2read.com'
];

// Normalize domain to ASCII (punycode) to prevent homograph attacks
export function normalizeDomain(hostname) {
  try {
    // Convert IDN to ASCII (punycode)
    const normalizedHostname = new URL(`https://${hostname}`).hostname;
    return normalizedHostname;
  } catch {
    return hostname.toLowerCase();
  }
}

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
  // Match valid IP addresses (0-255 per octet) embedded in domain names
  const ipPattern = /(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/;
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
  // Use exact domain matching to prevent bypasses
  const baseDomain = hostname.replace(/^www\./, '');
  return tempServices.some(service => baseDomain === service || baseDomain.endsWith('.' + service));
}

// Detect data URLs (can execute arbitrary code)
export function hasDataUrl(url) {
  return /^data:/i.test(url);
}

// Detect JavaScript URLs (can execute arbitrary code)
export function hasJavaScriptUrl(url) {
  return /^javascript:/i.test(url);
}

// Detect URL shorteners (can hide malicious destinations)
export function hasUrlShortener(hostname) {
  if (!hostname) return false;
  const shorteners = [
    'bit.ly', 'tinyurl.com', 'ow.ly', 'short.link', 'tiny.cc',
    'goo.gl', 'youtu.be', 'adf.ly', 'rebrand.ly', 'lnkd.in',
    't.co', 'buff.ly', 'is.gd', 'v.gd', 'tiny.pl'
  ];
  const baseDomain = hostname.replace(/^www\./, '');
  return shorteners.some(short => baseDomain === short || baseDomain.endsWith('.' + short));
}

// Calculate Shannon entropy of a string (detects randomness)
export function calculateEntropy(str) {
  if (!str || str.length === 0) return 0;
  
  const charCount = {};
  for (const char of str) {
    charCount[char] = (charCount[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(charCount)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

// Detect high-entropy domains (random-looking, potentially DGA-generated)
export function hasHighEntropyDomain(hostname) {
  if (!hostname) return false;
  
  // Extract domain without TLD
  const parts = hostname.split('.');
  if (parts.length < 2) return false;
  
  const domain = parts[parts.length - 2]; // Second-level domain
  if (domain.length < 6) return false; // Too short to analyze
  
  const entropy = calculateEntropy(domain);
  const entropyThreshold = 3.5; // High entropy threshold
  
  return entropy > entropyThreshold;
}

// Detect URL length anomalies
export function hasUrlLengthAnomaly(url) {
  if (!url) return false;
  return url.length > 150; // URLs longer than 150 chars are suspicious
}

// Analyze subdomain depth
export function analyzeSubdomainDepth(hostname) {
  if (!hostname) return { depth: 0, suspicious: false };
  
  const parts = hostname.split('.');
  const depth = parts.length - 2; // Subtract TLD and SLD
  
  return {
    depth,
    suspicious: depth > 4 // More than 4 subdomains is suspicious
  };
}

// Detect character substitutions (l→1, o→0, etc.)
export function hasCharacterSubstitutions(hostname) {
  if (!hostname) return false;
  
  // Common substitutions in phishing domains
  const substitutions = [
    /[l1]/g, // l or 1
    /[o0]/g, // o or 0
    /[rn]/g, // r or n (sometimes confused)
    /[uv]/g, // u or v
    /[ij]/g  // i or j
  ];
  
  let substitutionCount = 0;
  for (const pattern of substitutions) {
    const matches = hostname.match(pattern);
    if (matches && matches.length > 1) {
      substitutionCount += matches.length - 1; // Count extra occurrences
    }
  }
  
  return substitutionCount >= 2; // 2+ suspicious substitutions
}

// Enhanced domain similarity scoring with weighted character substitutions
export function calculateDomainSimilarity(domain1, domain2) {
  if (!domain1 || !domain2) return 0;
  
  const distance = calculateLevenshteinOptimized(domain1, domain2);
  const maxLength = Math.max(domain1.length, domain2.length);
  
  // Base similarity
  let similarity = 1 - (distance / maxLength);
  
  // Apply penalties for character substitutions
  const substitutionPenalty = calculateSubstitutionPenalty(domain1, domain2);
  similarity -= substitutionPenalty;
  
  // Apply bonus for exact TLD matches
  const tld1 = domain1.split('.').pop().toLowerCase();
  const tld2 = domain2.split('.').pop().toLowerCase();
  if (tld1 === tld2) {
    similarity += 0.1; // 10% bonus for same TLD
  }
  
  return Math.max(0, Math.min(1, similarity));
}

// Calculate penalty for common phishing character substitutions
function calculateSubstitutionPenalty(domain1, domain2) {
  const substitutions = {
    '0': 'o', '1': 'l', '1': 'i', '3': 'e', '4': 'a', '5': 's',
    '8': 'b', '@': 'a', '!': 'i', '$': 's'
  };
  
  let penalty = 0;
  const shorter = domain1.length < domain2.length ? domain1 : domain2;
  const longer = domain1.length >= domain2.length ? domain1 : domain2;
  
  for (let i = 0; i < shorter.length; i++) {
    const char1 = shorter[i].toLowerCase();
    const char2 = longer[i] ? longer[i].toLowerCase() : '';
    
    if (char1 !== char2) {
      // Check if this is a common substitution
      for (const [sub, original] of Object.entries(substitutions)) {
        if ((char1 === sub && char2 === original) || (char2 === sub && char1 === original)) {
          penalty += 0.15; // 15% penalty per substitution
          break;
        }
      }
    }
  }
  
  return Math.min(0.5, penalty); // Cap penalty at 50%
}

// Detect look-alike domains targeting major brands
export function detectLookalikeDomain(hostname) {
  if (!hostname) return { detected: false, target: null, similarity: 0 };
  
  const normalizedHostname = normalizeDomain(hostname);
  const domain = normalizedHostname.replace(/^www\./, '').toLowerCase();
  
  // Major brands to protect
  const targetBrands = [
    'google.com', 'facebook.com', 'amazon.com', 'microsoft.com',
    'apple.com', 'netflix.com', 'paypal.com', 'instagram.com',
    'twitter.com', 'linkedin.com', 'youtube.com', 'gmail.com',
    'outlook.com', 'yahoo.com', 'ebay.com', 'walmart.com',
    'bankofamerica.com', 'chase.com', 'wellsfargo.com', 'citibank.com'
  ];
  
  let bestMatch = null;
  let highestSimilarity = 0;
  
  for (const brand of targetBrands) {
    const similarity = calculateDomainSimilarity(domain, brand);
    
    // Lower threshold for high-value targets
    const threshold = getSimilarityThreshold(brand);
    
    if (similarity >= threshold && similarity > highestSimilarity) {
      bestMatch = brand;
      highestSimilarity = similarity;
    }
  }
  
  if (bestMatch && highestSimilarity > 0.7) {
    return {
      detected: true,
      target: bestMatch,
      similarity: Math.round(highestSimilarity * 100),
      risk: calculateLookalikeRisk(highestSimilarity, bestMatch)
    };
  }
  
  return { detected: false, target: null, similarity: 0 };
}

// Get similarity threshold based on brand value
function getSimilarityThreshold(brand) {
  const highValueBrands = ['google.com', 'facebook.com', 'amazon.com', 'paypal.com', 'apple.com'];
  const mediumValueBrands = ['microsoft.com', 'netflix.com', 'instagram.com', 'twitter.com'];
  
  if (highValueBrands.includes(brand)) return 0.65; // Lower threshold for high-value targets
  if (mediumValueBrands.includes(brand)) return 0.70;
  return 0.75; // Higher threshold for other brands
}

// Calculate risk level for look-alike domains
function calculateLookalikeRisk(similarity, targetBrand) {
  const highValueBrands = ['google.com', 'facebook.com', 'amazon.com', 'paypal.com', 'apple.com'];
  const isHighValue = highValueBrands.includes(targetBrand);
  
  let riskScore = similarity * 100;
  
  // Increase risk for high-value brands
  if (isHighValue) {
    riskScore += 15;
  }
  
  // Increase risk for very high similarity
  if (similarity > 0.85) {
    riskScore += 20;
  }
  
  return Math.min(100, Math.round(riskScore));
}
function calculateLevenshteinOptimized(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  // Use two arrays instead of full matrix
  let prevRow = Array.from({ length: len1 + 1 }, (_, i) => i);
  let currRow = [0];
  
  for (let i = 1; i <= len2; i++) {
    currRow[0] = i;
    
    for (let j = 1; j <= len1; j++) {
      const cost = str1[j - 1] === str2[i - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,      // Insertion
        prevRow[j] + 1,          // Deletion
        prevRow[j - 1] + cost    // Substitution
      );
    }
    
    [prevRow, currRow] = [currRow, prevRow];
  }
  
  return prevRow[len1];
}

// Detect homograph attacks (visual similarity using different scripts)
export function detectHomographAttack(hostname) {
  if (!hostname) return { detected: false, scripts: [], risk: 0 };
  
  const scripts = {
    cyrillic: /[а-яё]/i,
    greek: /[α-ω]/i,
    arabic: /[\u0600-\u06FF]/,
    hebrew: /[\u0590-\u05FF]/,
    cjk: /[\u4E00-\u9FFF\u3040-\u309F\uAC00-\uD7AF]/,
    zeroWidth: /[\u200B-\u200F\uFEFF]/, // Zero-width characters
    bidirectional: /[\u202A-\u202E]/ // Bidirectional override
  };
  
  const detectedScripts = [];
  let riskScore = 0;
  
  for (const [script, pattern] of Object.entries(scripts)) {
    if (pattern.test(hostname)) {
      detectedScripts.push(script);
      
      // Assign risk scores
      switch (script) {
        case 'cyrillic':
        case 'greek':
          riskScore += 25; // High risk for Latin lookalikes
          break;
        case 'zeroWidth':
        case 'bidirectional':
          riskScore += 30; // Very high risk for text manipulation
          break;
        case 'arabic':
        case 'hebrew':
          riskScore += 15; // Medium risk
          break;
        case 'cjk':
          riskScore += 10; // Lower risk
          break;
      }
    }
  }
  
  return {
    detected: detectedScripts.length > 0,
    scripts: detectedScripts,
    risk: Math.min(50, riskScore) // Cap at 50
  };
}

// Consensus threat intelligence checking
export async function checkThreatIntelligence(url) {
  const sources = [];
  let totalConfidence = 0;
  let positiveSources = 0;
  const details = {};

  try {
    // Import services dynamically to avoid circular dependencies
    const { checkSafeBrowsing } = await import('./services/safebrowsing.js');
    const { checkPhishTank } = await import('./services/phishtank.js');
    const { checkVirusTotal } = await import('./services/virustotal.js');
    const { checkOpenPhish } = await import('./services/openphish.js');
    const { checkURLhaus } = await import('./services/urlhaus.js');

    // Run all checks in parallel
    const results = await Promise.allSettled([
      checkSafeBrowsing(url),
      checkPhishTank(url),
      checkVirusTotal(url),
      checkOpenPhish(url),
      checkURLhaus(url)
    ]);

    // Process results
    const safeBrowsing = results[0].status === 'fulfilled' ? results[0].value : null;
    const phishTank = results[1].status === 'fulfilled' ? results[1].value : null;
    const virusTotal = results[2].status === 'fulfilled' ? results[2].value : null;
    const openPhish = results[3].status === 'fulfilled' ? results[3].value : null;
    const urlhaus = results[4].status === 'fulfilled' ? results[4].value : null;

    // Collect sources and calculate consensus
    if (safeBrowsing) {
      sources.push(safeBrowsing);
      if (safeBrowsing.listed) {
        positiveSources++;
        totalConfidence += 90; // High confidence
        details.safeBrowsing = safeBrowsing.details;
      }
    }

    if (phishTank) {
      sources.push(phishTank);
      if (phishTank.listed) {
        positiveSources++;
        totalConfidence += phishTank.confidence || 95;
        details.phishTank = phishTank.details;
      }
    }

    if (virusTotal) {
      sources.push(virusTotal);
      if (virusTotal.listed) {
        positiveSources++;
        totalConfidence += virusTotal.confidence || 50;
        details.virusTotal = virusTotal.details;
      }
    }

    if (openPhish) {
      sources.push(openPhish);
      if (openPhish.listed) {
        positiveSources++;
        totalConfidence += openPhish.confidence || 90;
        details.openPhish = openPhish.details;
      }
    }

    if (urlhaus) {
      sources.push(urlhaus);
      if (urlhaus.listed) {
        positiveSources++;
        totalConfidence += urlhaus.confidence || 95;
        details.urlhaus = urlhaus.details;
      }
    }

    // Calculate consensus
    const consensusConfidence = positiveSources > 0 ? Math.round(totalConfidence / positiveSources) : 0;
    const consensusListed = positiveSources >= 2 || (positiveSources === 1 && consensusConfidence >= 80);

    return {
      listed: consensusListed,
      confidence: consensusConfidence,
      positiveSources,
      totalSources: sources.length,
      sources: sources.map(s => ({ source: s.source, listed: s.listed, note: s.note })),
      details
    };

  } catch (err) {
    logger.error({ err: String(err) }, 'Threat intelligence consensus check failed');
    return {
      listed: false,
      confidence: 0,
      positiveSources: 0,
      totalSources: 0,
      sources: [],
      details: { error: err.message }
    };
  }
}

// Detect suspiciously long or random subdomains
export function hasSuspiciousSubdomain(hostname) {
  if (!hostname) return false;
  const parts = hostname.split('.');
  if (parts.length <= 2) return false; // No subdomains
  
  let suspicious = false;
  
  // Check each subdomain component (skip TLD and SLD)
  for (let i = 0; i < parts.length - 2; i++) {
    const subdomain = parts[i];
    
    // Check length
    if (subdomain.length > 20) {
      suspicious = true;
      break;
    }
    
    // Check excessive hyphens in any component
    const hyphenCount = (subdomain.match(/-/g) || []).length;
    if (hyphenCount > 4) {
      suspicious = true;
      break;
    }
    
    // Check for unusual characters
    if (!/^[a-z0-9-]+$/i.test(subdomain)) {
      suspicious = true;
      break;
    }
    
    // Check all numeric
    if (/^\d+$/.test(subdomain)) {
      suspicious = true;
      break;
    }
    
    // Check random-looking patterns (3+ hyphens with short segments)
    const segments = subdomain.split('-');
    if (segments.length >= 3) {
      const hasRandomPattern = segments.every(seg => seg.length <= 3);
      if (hasRandomPattern) {
        suspicious = true;
        break;
      }
    }
  }
  
  return suspicious;
}

// Advanced brand impersonation detection
export function detectBrandImpersonation(hostname) {
  if (!hostname) return { detected: false, brand: null, confidence: 0 };
  
  const normalizedHostname = normalizeDomain(hostname);
  
  for (const [brand, patterns] of Object.entries(BRAND_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedHostname)) {
        // Calculate confidence based on similarity
        const confidence = calculateSimilarityConfidence(normalizedHostname, brand);
        return { detected: true, brand, confidence };
      }
    }
  }
  
  return { detected: false, brand: null, confidence: 0 };
}

// Calculate visual similarity confidence
function calculateSimilarityConfidence(hostname, brand) {
  const distance = calculateLevenshteinOptimized(hostname, brand);
  const maxLength = Math.max(hostname.length, brand.length);
  const similarity = 1 - (distance / maxLength);
  
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
export function analyzeURLStructure(hostname, url) {
  if (!hostname) return { issues: [], score: 0 };
  
  const issues = [];
  let score = 0;
  
  // Too many subdomains
  const subdomainAnalysis = analyzeSubdomainDepth(hostname);
  if (subdomainAnalysis.suspicious) {
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
  
  // High entropy (random-looking)
  if (hasHighEntropyDomain(hostname)) {
    issues.push('high_entropy');
    score += 20;
  }
  
  // Character substitutions
  if (hasCharacterSubstitutions(hostname)) {
    issues.push('character_substitutions');
    score += 15;
  }
  
  // URL length anomaly
  if (url && hasUrlLengthAnomaly(url)) {
    issues.push('url_too_long');
    score += 10;
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
    const geoResponse = await fetch(`https://ip-api.com/json/${ip}`);
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
  let classification = 'low';
  if (score < 40) classification = 'high';
  else if (score < 70) classification = 'medium';
  else classification = 'low';

  return { score, classification, reasons };
}

// NEW: Weighted risk model to prevent single-factor bypass
export function computeWeightedScore(basicFactors, advancedFactors) {
  const weights = {
    noHttps: { weight: 0.15, maxDeduction: 25 },
    youngDomain: { weight: 0.12, maxDeduction: 30 },
    listedInFeeds: { weight: 0.40, maxDeduction: 60 },
    suspiciousKeywords: { weight: 0.08, maxDeduction: 20 },
    adultContent: { weight: 0.50, maxDeduction: 100 }, // Block adult content
    excessiveRedirects: { weight: 0.10, maxDeduction: 15 },
    ipObfuscation: { weight: 0.25, maxDeduction: 50 },
    temporaryService: { weight: 0.35, maxDeduction: 80 }, // Critical - tunneling services
    suspiciousSubdomain: { weight: 0.20, maxDeduction: 45 },
    dataUrl: { weight: 0.60, maxDeduction: 100 }, // Critical - code execution
    javascriptUrl: { weight: 0.60, maxDeduction: 100 }, // Critical - code execution
    urlShortener: { weight: 0.30, maxDeduction: 55 }, // High risk - hidden destination
    brandImpersonation: { weight: 0.30, maxDeduction: 65 },
    suspiciousTLD: { weight: 0.15, maxDeduction: 25 },
    geographicRisk: { weight: 0.12, maxDeduction: 30 },
    certificateIssues: { weight: 0.18, maxDeduction: 35 },
    lowReputation: { weight: 0.15, maxDeduction: 45 },
    highEntropy: { weight: 0.22, maxDeduction: 40 }, // Random domains
    urlTooLong: { weight: 0.08, maxDeduction: 18 }, // Anomalous length
    characterSubstitutions: { weight: 0.18, maxDeduction: 35 }, // l→1, o→0 patterns
    homographAttack: { weight: 0.28, maxDeduction: 50 } // Unicode tricks
  };
  
  let riskScore = 0;
  let totalWeight = 0;
  const reasons = [];
  const factors = { ...basicFactors, ...advancedFactors };
  
  // Calculate weighted risk score
  for (const [factor, config] of Object.entries(weights)) {
    if (factors[factor]) {
      let confidence = 1.0; // Default confidence
      
      // Adjust confidence based on factor type
      if (factor === 'brandImpersonation' && factors[factor].confidence) {
        confidence = factors[factor].confidence / 100;
      } else if (factor === 'geographicRisk' && factors[factor].score) {
        confidence = factors[factor].score / 25; // Normalize to 0-1
      } else if (factor === 'certificateIssues' && factors[factor].score) {
        confidence = factors[factor].score / 30;
      } else if (factor === 'lowReputation' && factors[factor].score !== undefined) {
        confidence = (60 - factors[factor].score) / 60; // Higher confidence for lower reputation
      } else if (factor === 'homographAttack' && factors[factor].risk) {
        confidence = factors[factor].risk / 50; // Normalize homograph risk
      }
      
      const weightedDeduction = config.weight * config.maxDeduction * confidence;
      riskScore += weightedDeduction;
      totalWeight += config.weight;
      
      reasons.push({
        code: factor.toUpperCase(),
        points: Math.round(weightedDeduction),
        weight: config.weight,
        confidence: Math.round(confidence * 100)
      });
    }
  }
  
  // Normalize to 0-100 scale (100 = safe, 0 = dangerous)
  const normalizedScore = Math.max(0, Math.min(100, 100 - riskScore));
  
  // Determine risk category
  let riskCategory = 'SAFE';
  if (normalizedScore < 25) riskCategory = 'DANGEROUS';
  else if (normalizedScore < 55) riskCategory = 'SUSPICIOUS';
  else if (normalizedScore < 80) riskCategory = 'MODERATE_RISK';
  else riskCategory = 'SAFE';
  
  return {
    score: Math.round(normalizedScore),
    riskCategory,
    reasons,
    confidence: totalWeight > 0 ? Math.round((totalWeight / Object.keys(weights).length) * 100) : 0
  };
}

export function classify(score) {
  // Updated 5-tier risk classification system:
  // Score ≥ 90: ALLOW (no warning)
  // Score 85-89: ALERT (show alert) 
  // Score 60-84: WARNING (show warning)
  // Score 40-59: HIGH ALERT (show warning)
  // Score < 40: BLOCK PERMANENTLY
  if (score >= 90) return 'allow';
  if (score >= 50) return 'warn';
  return 'block';
}

export function hasSuspiciousKeywords(url) {
  const lower = url.toLowerCase();
  return SUSPICIOUS_KEYWORDS.some(k => lower.includes(k));
}

export function hasAdultContent(url) {
  const lower = url.toLowerCase();
  
  // Check for adult content domains
  const domain = lower.replace(/^https?:\/\//, '').split('/')[0];
  if (ADULT_CONTENT_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) {
    return true;
  }
  
  // Check for adult content keywords
  return ADULT_CONTENT_KEYWORDS.some(k => lower.includes(k));
}
