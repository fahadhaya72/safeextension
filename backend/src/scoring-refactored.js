/**
 * Production-Grade URL Security Scoring Engine
 * Rule-based detection FIRST, then weighted scoring
 * Output: Clean, standardized result format
 */

import logger from './logger.js';
import { evaluateRules } from './rule-engine.js';
import { BrandDetector } from './brand-detector.js';
import { getDomainParts, extractSLD } from './domain-parser.js';

const brandDetector = new BrandDetector();

// Adult content keywords - automatic BLOCK
const ADULT_CONTENT_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xhamster.com', 'youporn.com', 'redtube.com',
  'tube8.com', 'spankbang.com', 'eporner.com', 'chaturbate.com', 'bongacams.com',
  'stripchat.com', 'camsoda.com', 'livejasmin.com', 'onlyfans.com'
];

const ADULT_KEYWORDS = [
  'pornhub', 'xvideos', 'xhamster', 'porn', 'xxx', 'adult', 'nsfw', 'erotic'
];

// Phishing keywords (used for scoring, not blocking)
const PHISHING_KEYWORDS = [
  'login', 'signin', 'verify', 'confirm', 'secure', 'update',
  'account', 'password', 'authenticate', 'suspended'
];

// ============ RULE ENGINE INTEGRATION ============

/**
 * Core evaluation function - rules first, then scoring
 * @returns Standardized output: { action, score, reasons, confidence }
 */
export async function evaluateURL(url, hostname) {
  const result = {
    action: 'allow', // 'allow', 'warn', 'block'
    score: 100,       // 0-100, higher = safer
    riskLevel: 'none', // 'none', 'low', 'medium', 'high', 'critical'
    reasons: [],
    confidence: 100,
    debug: []
  };

  try {
    // STEP 1: Trusted domains check (automatic ALLOW with high score)
    const trustedCheck = checkTrustedDomain(hostname);
    if (trustedCheck.isTrusted) {
      return {
        action: 'allow',
        score: 100,
        riskLevel: 'none',
        reasons: ['Trusted domain'],
        confidence: 100,
        type: 'trusted-domain'
      };
    }

    // STEP 2: Adult content check (automatic BLOCK)
    const adultCheck = checkAdultContent(url, hostname);
    if (adultCheck.isAdult) {
      return {
        action: 'block',
        score: 0,
        riskLevel: 'critical',
        reasons: ['Adult content detected'],
        confidence: 100,
        type: 'adult-content'
      };
    }

    // STEP 3: Apply strict rules (before scoring)
    const { shouldBlock, shouldWarn, reasons: ruleReasons } = evaluateRules(url, hostname);
    
    if (shouldBlock) {
      return {
        action: 'block',
        score: 10,
        riskLevel: 'critical',
        reasons: ruleReasons,
        confidence: 95,
        type: 'rule-engine'
      };
    }

    // STEP 3: Weighted scoring for non-blocked URLs
    const scoreResult = await computeWeightedScore(url, hostname);
    
    // STEP 4: Apply WARN from rules
    if (shouldWarn && scoreResult.action !== 'block') {
      scoreResult.ruleWarnings = ruleReasons;
      if (scoreResult.action === 'allow') {
        scoreResult.action = 'warn';
      }
    }

    return scoreResult;

  } catch (err) {
    logger.error({ err: String(err), url }, 'URL evaluation failed');
    return {
      action: 'warn',
      score: 50,
      riskLevel: 'high',
      reasons: ['Evaluation error: ' + err.message],
      confidence: 0,
      error: true
    };
  }
}

// ============ TRUSTED DOMAINS CHECK ============

// Comprehensive trusted domains list (same as rule-engine)
const TRUSTED_DOMAINS_LIST = [
  // Search & Web Browsers
  'google.com', 'google.co.uk', 'google.ca', 'google.fr', 'google.de',
  'bing.com', 'duckduckgo.com', 'yandex.com', 'baidu.com',
  
  // Video Platforms
  'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
  
  // Social Media
  'facebook.com', 'fb.com', 'fbcdn.net', 'twitter.com', 'x.com',
  'instagram.com', 'linkedin.com', 'reddit.com', 'tiktok.com',
  'snapchat.com', 'pinterest.com', 'nextdoor.com',
  
  // AI/ML Platforms
  'openai.com', 'chat.openai.com', 'chatgpt.com', 'anthropic.com',
  'claude.ai', 'google.ai', 'deepmind.com', 'huggingface.co',
  'perplexity.ai', 'github.com/copilot',
  
  // Tech Giants
  'microsoft.com', 'apple.com', 'icloud.com', 'amazon.com',
  'github.com', 'gitlab.com', 'bitbucket.org', 'sourceforge.net',
  
  // Email & Communication
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
  'protonmail.com', 'proton.me', 'tutanota.com', 'mail.google.com',
  
  // Developer & Tech Communities
  'stackoverflow.com', 'dev.to', 'medium.com', 'hashnode.com',
  'freecodecamp.org', 'w3schools.com', 'mdn.mozilla.org',
  
  // News & Media
  'bbc.com', 'bbc.co.uk', 'cnn.com', 'reuters.com', 'apnews.com',
  'nytimes.com', 'theguardian.com', 'aljazeera.com', 'npr.org',
  'pbs.org', 'politico.com',
  
  // Entertainment & Streaming
  'netflix.com', 'hulu.com', 'disneyplus.com', 'primevideo.com',
  'hbo.com', 'hbomax.com', 'peacock.com', 'paramount.com',
  'spotify.com', 'music.apple.com', 'deezer.com',
  
  // Finance & Payments
  'paypal.com', 'stripe.com', 'square.com', 'coinbase.com',
  'kraken.com', 'binance.com', 'bitstamp.net',
  
  // Banking (Major International Banks)
  'bankofamerica.com', 'chase.com', 'wellsfargo.com', 'citibank.com',
  'hsbc.com', 'barclays.com', 'ing.com', 'bnp.fr',
  'santander.com', 'deutschebank.de',
  
  // Shopping & Retail
  'amazon.com', 'ebay.com', 'walmart.com', 'bestbuy.com',
  'target.com', 'macys.com', 'nordstrom.com', 'etsy.com',
  
  // Reference & Education
  'wikipedia.org', 'wikimedia.org', 'coursera.org', 'udemy.com',
  'edx.org', 'khanacademy.org', 'mit.edu', 'stanford.edu',
  'harvard.edu', 'oxford.edu', 'cambridge.edu',
  
  // Government & Official
  'gov.uk', 'gov.us', 'irs.gov', 'dmv.org', 'whitehouse.gov',
  'parliament.uk',
  
  // Cloud Services & Storage
  'drive.google.com', 'dropbox.com', 'onedrive.com', 'icloud.com',
  'aws.amazon.com', 'azure.microsoft.com', 'cloud.google.com',
  
  // Office & Productivity
  'office.com', 'office365.com', 'sheets.google.com',
  'docs.google.com', 'notion.so', 'asana.com', 'monday.com',
  'trello.com', 'slack.com', 'zoom.us', 'teams.microsoft.com',
  'meet.google.com',
  
  // Travel & Booking
  'booking.com', 'expedia.com', 'kayak.com', 'tripadvisor.com',
  'airbnb.com', 'hotels.com', 'skyscanner.com',
  
  // Health & Wellness
  'webmd.com', 'mayoclinic.org', 'healthline.com', 'cdc.gov',
  'who.int', 'nhs.uk'
];

function getTrustedDomains() {
  return TRUSTED_DOMAINS_LIST;
}

function checkTrustedDomain(hostname) {
  if (!hostname) return { isTrusted: false };
  
  const trustedDomains = getTrustedDomains();
  const lowerHostname = hostname.toLowerCase();
  
  // Check exact match and subdomain match
  for (const trustedDomain of trustedDomains) {
    if (lowerHostname === trustedDomain || 
        lowerHostname.endsWith('.' + trustedDomain) ||
        lowerHostname.startsWith('www.' + trustedDomain)) {
      return { isTrusted: true, domain: trustedDomain };
    }
  }
  
  return { isTrusted: false };
}

// ============ ADULT CONTENT CHECK ============

function checkAdultContent(url, hostname) {
  const lower = url.toLowerCase();
  const hostLower = hostname.toLowerCase();
  
  // Check domain
  for (const domain of ADULT_CONTENT_DOMAINS) {
    if (hostLower === domain || hostLower.endsWith('.' + domain)) {
      return { isAdult: true, reason: 'Known adult domain' };
    }
  }
  
  // Check keywords
  for (const keyword of ADULT_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { isAdult: true, reason: 'Adult keyword detected' };
    }
  }
  
  return { isAdult: false };
}

// ============ MAIN SCORING ENGINE ============

/**
 * Compute weighted security score for URL
 * Applied AFTER rules (so rules already blocked worst cases)
 */
async function computeWeightedScore(url, hostname) {
  const factors = {};
  let totalRiskPoints = 0;
  const reasons = [];

  try {
    // Parse URL components
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    const pathname = urlObj.pathname;
    const search = urlObj.search;

    const { root: rootDomain, subdomain } = getDomainParts(hostname);

    // ===== FACTOR 1: HTTPS (10 points max) =====
    if (protocol !== 'https:') {
      totalRiskPoints += 10;
      reasons.push('Non-HTTPS protocol');
    }

    // ===== FACTOR 2: Brand Impersonation (20 points max) =====
    const brandCheck = brandDetector.detect(hostname, rootDomain);
    if (brandCheck.isImpersonation) {
      totalRiskPoints += Math.min(20, 20 * brandCheck.confidence);
      reasons.push(`Brand spoofing: ${brandCheck.brand} (${Math.round(brandCheck.confidence * 100)}%)`);
    }

    // ===== FACTOR 3: Subdomain Depth (8 points max) =====
    const subdomainParts = hostname.split('.');
    if (subdomainParts.length > 4) {
      const excessLevels = subdomainParts.length - 4;
      totalRiskPoints += Math.min(8, 2 * excessLevels);
      reasons.push(`Excessive subdomains (${subdomainParts.length} levels)`);
    }

    // ===== FACTOR 4: URL Length (5 points max) =====
    if (url.length > 150) {
      totalRiskPoints += 5;
      reasons.push('Abnormally long URL');
    }

    // ===== FACTOR 5: Phishing Keywords (12 points max) =====
    const phishingCount = PHISHING_KEYWORDS.filter(kw => hostname.toLowerCase().includes(kw)).length;
    if (phishingCount > 0) {
      totalRiskPoints += Math.min(12, 4 * phishingCount);
      reasons.push(`Phishing keywords detected (${phishingCount})`);
    }

    // ===== FACTOR 6: High Entropy Domain (15 points max) =====
    const entropy = calculateEntropy(extractSLD(hostname));
    if (entropy > 3.8) {
      totalRiskPoints += 15;
      reasons.push(`High-entropy domain (possible DGA)`);
    }

    // ===== FACTOR 7: Character Substitutions (8 points max) =====
    const subCount = countCharacterSubstitutions(hostname);
    if (subCount > 0) {
      totalRiskPoints += Math.min(8, 2 * subCount);
      reasons.push(`Character substitution patterns (${subCount})`);
    }

    // ===== FACTOR 8: URL Shortener (12 points max) =====
    if (isURLShortener(hostname)) {
      totalRiskPoints += 12;
      reasons.push('URL shortener detected');
    }

    // ===== FACTOR 9: Temporary/Tunnel Service (25 points max) =====
    if (isTemporaryService(hostname)) {
      totalRiskPoints += 25;
      reasons.push('Temporary/tunnel service detected');
    }

    // ===== FACTOR 10: IP-Based URL (10 points max) =====
    if (isIPBasedURL(hostname)) {
      totalRiskPoints += 10;
      reasons.push('IP-based URL (no domain)');
    }

    // Threat intelligence check (optional, async)
    if (process.env.ENABLE_THREAT_INTEL !== 'false') {
      try {
        const threatResult = await checkThreatIntelligence(url);
        if (threatResult.isListed) {
          totalRiskPoints += 40; // High penalty from threat feeds
          reasons.push(`Listed in threat feeds (${threatResult.sources})`);
        }
      } catch (err) {
        logger.warn({ err: String(err) }, 'Threat intel check failed');
      }
    }

  } catch (err) {
    logger.error({ err: String(err), url }, 'Scoring error');
    return {
      action: 'warn',
      score: 50,
      riskLevel: 'high',
      reasons: ['Scoring error: ' + err.message],
      confidence: 70
    };
  }

  // Convert risk points to safety score (100 = safe, 0 = dangerous)
  const score = Math.max(0, Math.min(100, 100 - totalRiskPoints));

  // Classify action based on score
  let action = 'allow';
  let riskLevel = 'none';

  if (score < 20) {
    action = 'block';
    riskLevel = 'critical';
  } else if (score < 40) {
    action = 'block';
    riskLevel = 'high';
  } else if (score < 60) {
    action = 'warn';
    riskLevel = 'medium';
  } else if (score < 80) {
    action = 'warn';
    riskLevel = 'low';
  }

  return {
    action,
    score: Math.round(score),
    riskLevel,
    reasons,
    confidence: Math.min(95, 50 + Math.abs(score - 50) / 2)
  };
}

// ============ HELPER FUNCTIONS ============

function calculateEntropy(str) {
  if (!str || str.length === 0) return 0;
  
  const charCount = {};
  for (const char of str) {
    charCount[char] = (charCount[char] || 0) + 1;
  }
  
  let entropy = 0;
  for (const count of Object.values(charCount)) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

function countCharacterSubstitutions(hostname) {
  let count = 0;
  
  // Only count actual suspicious substitutions, not normal characters
  // Look for mixed usage of similar characters in the same word
  const words = hostname.split('.');
  
  for (const word of words) {
    if (word.length < 3) continue; // Skip very short words
    
    // Check for mixed 0/o usage
    const hasZero = word.includes('0');
    const hasLetterO = word.includes('o');
    if (hasZero && hasLetterO) count++;
    
    // Check for mixed 1/l/I usage  
    const hasOne = word.includes('1');
    const hasLetterL = word.includes('l');
    const hasLetterI = word.includes('I');
    if ((hasOne && hasLetterL) || (hasOne && hasLetterI) || (hasLetterL && hasLetterI)) count++;
    
    // Check for mixed 5/s usage
    const hasFive = word.includes('5');
    const hasLetterS = word.includes('s');
    if (hasFive && hasLetterS) count++;
    
    // Check for @/a usage (only suspicious if @ is used)
    if (word.includes('@') && word.includes('a')) count++;
  }
  
  return count;
}

function isURLShortener(hostname) {
  const shorteners = [
    'bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'goo.gl',
    'adf.ly', 'rebrand.ly', 'is.gd', 'short.link'
  ];
  
  for (const shortener of shorteners) {
    if (hostname === shortener || hostname.endsWith('.' + shortener)) {
      return true;
    }
  }
  return false;
}

function isTemporaryService(hostname) {
  const services = [
    'trycloudflare.com', 'ngrok.io', 'ngrok-free.app', 'serveo.net',
    'localtunnel.me', 'pagekite.me', 'tunnelto.dev'
  ];
  
  for (const service of services) {
    if (hostname === service || hostname.endsWith('.' + service)) {
      return true;
    }
  }
  return false;
}

function isIPBasedURL(hostname) {
  // IPv4 pattern
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  // Hex IP
  if (/^0x/i.test(hostname)) {
    return true;
  }
  return false;
}

/**
 * Basic threat intelligence check
 * Returns combined result from multiple sources
 */
async function checkThreatIntelligence(url) {
  try {
    // Import services
    const { checkSafeBrowsing } = await import('./services/safebrowsing.js').catch(() => ({ checkSafeBrowsing: null }));
    const { checkPhishTank } = await import('./services/phishtank.js').catch(() => ({ checkPhishTank: null }));

    const results = [];
    
    if (checkSafeBrowsing) {
      try {
        const result = await checkSafeBrowsing(url);
        if (result?.listed) results.push('SafeBrowsing');
      } catch (err) {
        // Silent fail
      }
    }
    
    if (checkPhishTank) {
      try {
        const result = await checkPhishTank(url);
        if (result?.listed) results.push('PhishTank');
      } catch (err) {
        // Silent fail
      }
    }

    return {
      isListed: results.length > 0,
      sources: results.join(', ')
    };
  } catch (err) {
    return { isListed: false, sources: '' };
  }
}

// ============ BACKWARDS COMPATIBILITY ============

export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function classify(score) {
  if (score >= 80) return 'allow';
  if (score >= 50) return 'warn';
  return 'block';
}

export function analyzeUrlSyntax(url) {
  try {
    const u = new URL(url);
    return {
      protocol: u.protocol.replace(':', ''),
      hostname: u.hostname,
      path: u.pathname + (u.search || '')
    };
  } catch {
    return { protocol: null, hostname: null, path: null };
  }
}
