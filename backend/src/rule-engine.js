/**
 * Strict Rule-Based Phishing Detection Engine
 * These rules are evaluated BEFORE scoring and can immediately BLOCK/WARN URLs
 */

import { getDomainParts, extractSLD } from './domain-parser.js';

// Comprehensive trusted domains whitelist
const TRUSTED_DOMAINS = {
  // Search & Web Browsers
  search: [
    'google.com', 'google.co.uk', 'google.ca', 'google.fr', 'google.de',
    'bing.com', 'duckduckgo.com', 'yandex.com', 'baidu.com'
  ],

  // Video Platforms
  video: [
    'youtube.com', 'youtu.be',
    'vimeo.com',
    'dailymotion.com'
  ],

  // Social Media
  social: [
    'facebook.com', 'fb.com', 'fbcdn.net',
    'twitter.com', 'x.com',
    'instagram.com',
    'linkedin.com',
    'reddit.com',
    'tiktok.com',
    'snapchat.com',
    'pinterest.com',
    'nextdoor.com'
  ],

  // AI/ML Platforms
  ai: [
    'openai.com', 'chatgpt.com',
    'anthropic.com', 'claude.ai',
    'google.ai', 'deepmind.com',
    'huggingface.co',
    'perplexity.ai',
    'github.com/copilot'
  ],

  // Tech Giants
  tech: [
    'microsoft.com',
    'apple.com', 'icloud.com',
    'amazon.com',
    'github.com',
    'gitlab.com',
    'bitbucket.org',
    'sourceforge.net'
  ],

  // Email & Communication
  email: [
    'gmail.com',
    'outlook.com', 'hotmail.com',
    'yahoo.com',
    'protonmail.com', 'proton.me',
    'tutanota.com',
    'mail.google.com'
  ],

  // Developer & Tech Communities
  developer: [
    'stackoverflow.com',
    'dev.to',
    'medium.com',
    'hashnode.com',
    'freecodecamp.org',
    'w3schools.com',
    'mdn.mozilla.org'
  ],

  // News & Media
  news: [
    'bbc.com', 'bbc.co.uk',
    'cnn.com',
    'reuters.com',
    'apnews.com',
    'nytimes.com',
    'theguardian.com',
    'aljazeera.com',
    'npr.org',
    'pbs.org',
    'politico.com'
  ],

  // Entertainment & Streaming
  entertainment: [
    'netflix.com',
    'hulu.com',
    'disneyplus.com',
    'primevideo.com',
    'hbo.com', 'hbomax.com',
    'peacock.com',
    'paramount.com',
    'spotify.com',
    'music.apple.com',
    'deezer.com'
  ],

  // Finance & Payments
  finance: [
    'paypal.com',
    'stripe.com',
    'square.com',
    'coinbase.com',
    'kraken.com',
    'binance.com',
    'bitstamp.net'
  ],

  // Banking (Major International Banks)
  banking: [
    'bankofamerica.com',
    'chase.com',
    'wellsfargo.com',
    'citibank.com',
    'hsbc.com',
    'barclays.com',
    'ing.com',
    'bnp.fr',
    'santander.com',
    'deutschebank.de'
  ],

  // Shopping & Retail
  shopping: [
    'amazon.com',
    'ebay.com',
    'walmart.com',
    'bestbuy.com',
    'target.com',
    'macys.com',
    'nordstrom.com',
    'etsy.com'
  ],

  // Reference & Education
  education: [
    'wikipedia.org',
    'wikimedia.org',
    'coursera.org',
    'udemy.com',
    'edx.org',
    'khanacademy.org',
    'mit.edu',
    'stanford.edu',
    'harvard.edu',
    'oxford.edu',
    'cambridge.edu'
  ],

  // Government & Official
  government: [
    'gov.uk',
    'gov.us',
    'irs.gov',
    'dmv.org',
    'whitehouse.gov',
    'parliament.uk'
  ],

  // Cloud Services & Storage
  cloud: [
    'drive.google.com',
    'dropbox.com',
    'onedrive.com',
    'icloud.com',
    'aws.amazon.com',
    'azure.microsoft.com',
    'cloud.google.com'
  ],

  // Office & Productivity
  productivity: [
    'office.com', 'office365.com',
    'sheets.google.com',
    'docs.google.com',
    'notion.so',
    'asana.com',
    'monday.com',
    'trello.com',
    'slack.com',
    'zoom.us',
    'teams.microsoft.com',
    'meet.google.com'
  ],

  // Travel & Booking
  travel: [
    'booking.com',
    'expedia.com',
    'kayak.com',
    'tripadvisor.com',
    'airbnb.com',
    'hotels.com',
    'skyscanner.com'
  ],

  // Health & Wellness
  health: [
    'webmd.com',
    'mayoclinic.org',
    'healthline.com',
    'cdc.gov',
    'who.int',
    'nhs.uk'
  ]
};

// Helper function to flatten trusted domains for easier lookup
const getAllTrustedDomains = () => {
  const allDomains = [];
  for (const category of Object.values(TRUSTED_DOMAINS)) {
    allDomains.push(...category);
  }
  return allDomains;
};

// Export both structured and flat versions
export { TRUSTED_DOMAINS, getAllTrustedDomains };

const PHISHING_KEYWORDS = [
  'login', 'signin', 'verify', 'confirm', 'authenticate',
  'secure', 'update', 'account', 'password', 'credential',
  'bank', 'paypal', 'amazon', 'apple', 'google', 'microsoft',
  'suspended', 'urgent', 'action', 'required', 'expire',
  'click', 'submit', 'access'
];

const SUSPICIOUS_TLDS = new Set([
  'xyz', 'top', 'click', 'gq', 'tk', 'ml', 'ga', 'cf',
  'men', 'download', 'loan', 'racing', 'win', 'party',
  'trade', 'webcam', 'date', 'review', 'science', 'stream'
]);

class RuleResult {
  constructor(blocked = false, warned = false, reasons = []) {
    this.blocked = blocked;
    this.warned = warned;
    this.reasons = reasons;
  }

  addReason(reason) {
    this.reasons.push(reason);
  }
}

// RULE 1: Javascript and Data URLs - IMMEDIATE BLOCK
export function checkCodeExecutionURL(url) {
  const result = new RuleResult();
  
  if (/^javascript:/i.test(url)) {
    result.blocked = true;
    result.addReason('JavaScript URL detected - code execution risk');
  }
  
  if (/^data:/i.test(url)) {
    result.blocked = true;
    result.addReason('Data URL detected - code execution risk');
  }
  
  return result;
}

// RULE 2: Punycode/Homograph Attacks - IMMEDIATE BLOCK
export function checkHomographAttack(hostname) {
  const result = new RuleResult();
  
  if (!hostname) return result;
  
  // Check for punycode encoding (xn-- prefix)
  if (/xn--/i.test(hostname)) {
    result.blocked = true;
    result.addReason('Punycode detected - potential homograph attack');
    return result;
  }
  
  // Check for mixed Unicode scripts (Cyrillic, Greek, Latin mix)
  const hasCyrillic = /[а-яё]/i.test(hostname);
  const hasGreek = /[α-ω]/i.test(hostname);
  const hasArabic = /[\u0600-\u06FF]/.test(hostname);
  const hasHebrew = /[\u0590-\u05FF]/.test(hostname);
  const hasCJK = /[\u4E00-\u9FFF\u3040-\u309F\uAC00-\uD7AF]/.test(hostname);
  
  const unicodeScripts = [hasCyrillic, hasGreek, hasArabic, hasHebrew, hasCJK].filter(x => x).length;
  
  if (unicodeScripts > 0) {
    result.blocked = true;
    result.addReason('Unicode homograph attack detected - mixed character sets');
    return result;
  }
  
  // Check for zero-width characters or bidirectional overrides
  if (/[\u200B-\u200F\uFEFF\u202A-\u202E]/.test(hostname)) {
    result.blocked = true;
    result.addReason('Zero-width or bidirectional override characters detected');
  }
  
  return result;
}

// RULE 3: Brand Spoof Detection - BLOCK or WARN
export function checkBrandSpoof(hostname) {
  const result = new RuleResult();
  
  if (!hostname) return result;
  
  const lower = hostname.toLowerCase();
  const { root } = getDomainParts(hostname);
  const allTrustedDomains = getAllTrustedDomains();
  
  // Early exit: Check if this is a trusted domain
  if (allTrustedDomains.some(trusted => lower === trusted || lower.endsWith('.' + trusted))) {
    // This is a legitimate trusted domain
    return result;
  }
  
  // Check if domain contains brand name but is not trusted
  for (const trustedDomain of allTrustedDomains) {
    const brandName = trustedDomain.split('.')[0]; // Extract brand name from domain
    if (lower.includes(brandName) && brandName.length > 2) { // Only check meaningful brand names
      // Double-check it's NOT a trusted domain
      if (!allTrustedDomains.some(trusted => lower === trusted || lower.endsWith('.' + trusted))) {
        // CASE 1: Brand in subdomain (paypal.secure-login.com)
        if (hostname.toLowerCase().split('.').some(part => part.includes(brand)) && 
            hostname.split('.').length > 2) {
          result.blocked = true;
          result.addReason(`Brand name "${brand}" injected in subdomain - spoofing attack`);
          return result;
        }
        
        // CASE 2: Brand in domain + phishing keywords
        const hasPhishingKeywords = PHISHING_KEYWORDS.some(kw => lower.includes(kw));
        if (hasPhishingKeywords) {
          result.blocked = true;
          result.addReason(`Brand "${brand}" + phishing keywords detected - likely spoofing`);
          return result;
        }
        
        // CASE 3: Similar but slightly off (paypa1.com vs paypal.com)
        if (brand.length >= 4) {
          const similarity = calculateSimilarity(brand, extractSLD(hostname));
          if (similarity > 0.75 && similarity < 0.99) {
            result.warned = true;
            result.addReason(`Domain similar to brand "${brand}" - possible typosquatting`);
          }
        }
      }
    }
  }
  
  return result;
}

// RULE 4: Deep Subdomain Chains - BLOCK
export function checkSubdomainChains(hostname) {
  const result = new RuleResult();
  
  if (!hostname) return result;
  
  const parts = hostname.split('.');
  
  // More than 4 levels is highly suspicious (www is normal, but beyond that...)
  if (parts.length > 5) {
    result.blocked = true;
    result.addReason(`Excessive subdomain depth (${parts.length} levels) - obfuscation attempt`);
    return result;
  }
  
  // Check for pattern: legitimate.domain.included.fake-tld
  // Example: paypal.com.malicious.xyz
  const lower = hostname.toLowerCase();
  const allTrustedDomains = getAllTrustedDomains();
  for (const trustedDomain of allTrustedDomains) {
    const brandName = trustedDomain.split('.')[0];
    if (lower.includes(`${brandName}.com`)) {
      const { root } = getDomainParts(hostname);
      if (!root.endsWith(trustedDomain) && !allTrustedDomains.some(trusted => root === trusted || root.endsWith('.' + trusted))) {
        result.blocked = true;
        result.addReason('Legitimate domain buried in subdomain chain - spoofing');
        return result;
      }
    }
  }
  
  return result;
}

// RULE 5: Suspicious TLD with Keywords - BLOCK or WARN
export function checkSuspiciousTLD(hostname) {
  const result = new RuleResult();
  
  if (!hostname) return result;
  
  const parts = hostname.split('.');
  const tld = parts[parts.length - 1].toLowerCase();
  
  if (SUSPICIOUS_TLDS.has(tld)) {
    // Check combined threat level
    const hasPhishingKeywords = PHISHING_KEYWORDS.some(kw => hostname.toLowerCase().includes(kw));
    const allTrustedDomains = getAllTrustedDomains();
    const hasBrand = allTrustedDomains.some(trusted => {
      const brandName = trusted.split('.')[0];
      return hostname.toLowerCase().includes(brandName);
    });
    
    if (hasPhishingKeywords || hasBrand) {
      result.blocked = true;
      result.addReason(`Suspicious TLD ".${tld}" combined with phishing keywords/brands`);
    } else {
      result.warned = true;
      result.addReason(`Suspicious TLD ".${tld}" detected`);
    }
  }
  
  return result;
}

// RULE 6: IP-Based URLs - WARN
export function checkIPBasedURL(hostname) {
  const result = new RuleResult();
  
  if (!hostname) return result;
  
  // Check for IPv4
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(hostname)) {
    result.warned = true;
    result.addReason('IP-based URL detected - bypassing domain trust');
  }
  
  // Check for hex IP  
  if (/^0x/i.test(hostname)) {
    result.warned = true;
    result.addReason('Hexadecimal IP address detected');
  }
  
  return result;
}

// RULE 7: Character Substitution (Typosquatting) - BLOCK or WARN
export function checkCharacterSubstitution(hostname) {
  const result = new RuleResult();
  
  if (!hostname) return result;
  
  const sld = extractSLD(hostname).toLowerCase();
  
  // Check against known brand names with possible substitutions
  const allTrustedDomains = getAllTrustedDomains();
  for (const trustedDomain of allTrustedDomains) {
    const brandName = trustedDomain.split('.')[0];
    const substitutions = generateSubstitutions(brandName);
    
    for (const sub of substitutions) {
      if (sld === sub && sld !== brandName) {
        const similarity = calculateSimilarity(brandName, sld);
        
        if (similarity > 0.85) {
          result.blocked = true;
          result.addReason(`Character substitution detected: "${sld}" ≈ "${brandName}" - typosquatting`);
          return result;
        }
      }
    }
  }
  
  // Check for common substitution patterns in general
  const substitutionCount = countSubstitutions(sld);
  if (substitutionCount >= 2) {
    result.warned = true;
    result.addReason(`Multiple character substitutions detected (${substitutionCount}) - possible typosquatting`);
  }
  
  return result;
}

// RULE 8: URL Length Abuse - WARN
export function checkURLLength(url, hostname) {
  const result = new RuleResult();
  
  if (!url) return result;
  
  // Extremely long URLs are often obfuscation attempts
  if (url.length > 150) {
    result.warned = true;
    result.addReason(`Excessively long URL (${url.length} chars) - potential obfuscation`);
  }
  
  // Many queries/fragments
  const queryCount = (url.match(/[\?&]/g) || []).length;
  if (queryCount > 10) {
    result.warned = true;
    result.addReason(`Excessive query parameters (${queryCount}) - keyword stuffing`);
  }
  
  return result;
}

// RULE 9: URL Shorteners - WARN
export function checkURLShortener(hostname) {
  const result = new RuleResult();
  
  const shorteners = [
    'bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'short.link',
    'goo.gl', 'youtu.be', 'adf.ly', 'rebrand.ly', 'is.gd'
  ];
  
  for (const shortener of shorteners) {
    if (hostname.toLowerCase() === shortener || 
        hostname.toLowerCase().endsWith(shortener)) {
      result.warned = true;
      result.addReason(`URL shortener detected (${shortener}) - hidden destination`);
      break;
    }
  }
  
  return result;
}

// Helper functions

function calculateSimilarity(str1, str2) {
  // Levenshtein-based similarity
  const len1 = str1.length;
  const len2 = str2.length;
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2[i - 1] === str1[j - 1]) {
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

function generateSubstitutions(brand) {
  const subs = [brand];
  
  // Common substitutions
  const substitutionMap = {
    'a': ['@'],
    'e': ['3'],
    'i': ['1', '!'],
    'l': ['1', '|'],
    'o': ['0'],
    's': ['5', '$'],
    't': ['7'],
    'b': ['8'],
    'g': ['9']
  };
  
  // Generate first substitution only (for performance)
  for (const [char, replacements] of Object.entries(substitutionMap)) {
    if (brand.includes(char)) {
      for (const replacement of replacements) {
        subs.push(brand.replace(char, replacement));
      }
    }
  }
  
  return subs;
}

function countSubstitutions(hostname) {
  let count = 0;
  
  // Count suspicious character combinations
  if (/[0o]/g.test(hostname) && /[0o]/.test(hostname)) count++;
  if (/[1il]/g.test(hostname) && /[1il]/.test(hostname)) count++;
  if (/[5s]/g.test(hostname) && /[5s]/.test(hostname)) count++;
  if (/[@a]/g.test(hostname) && /[@a]/.test(hostname)) count++;
  
  return count;
}

// Main rule engine - evaluates all rules
export function evaluateRules(url, hostname) {
  const allReasons = [];
  let shouldBlock = false;
  let shouldWarn = false;
  
  const rules = [
    checkCodeExecutionURL(url),
    checkHomographAttack(hostname),
    checkBrandSpoof(hostname),
    checkSubdomainChains(hostname),
    checkSuspiciousTLD(hostname),
    checkIPBasedURL(hostname),
    checkCharacterSubstitution(hostname),
    checkURLLength(url, hostname),
    checkURLShortener(hostname)
  ];
  
  for (const rule of rules) {
    if (rule.blocked) {
      shouldBlock = true;
      allReasons.push(...rule.reasons);
    }
    if (rule.warned && !shouldBlock) {
      shouldWarn = true;
      allReasons.push(...rule.reasons);
    }
  }
  
  return {
    shouldBlock,
    shouldWarn,
    reasons: allReasons
  };
}
