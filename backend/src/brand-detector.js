/**
 * Brand Detection Module
 * Detects brand impersonation with similarity scoring
 */

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

export class BrandDetector {
  constructor() {
    this.trustedDomains = getAllTrustedDomains();
  }

  /**
   * Detect if a hostname is impersonating a brand
   * @param {string} hostname - Domain hostname
   * @param {string} rootDomain - Root domain extracted
   * @returns {object} Detection result with confidence and reasons
   */
  detect(hostname, rootDomain) {
    const result = {
      isImpersonation: false,
      brand: null,
      confidence: 0,
      reasons: [],
      riskLevel: 'none' // none, low, medium, high, critical
    };

    if (!hostname || !rootDomain) return result;

    const lower = hostname.toLowerCase();
    const rootLower = rootDomain.toLowerCase();

    // Early exit: Check if this is a trusted domain
    if (this.trustedDomains.some(trusted => rootLower === trusted || lower.endsWith('.' + trusted))) {
      // This is a legitimate trusted domain
      return result;
    }

    // Check for brand impersonation using trusted domain names
    for (const trustedDomain of this.trustedDomains) {
      const brandName = trustedDomain.split('.')[0]; // Extract brand name from domain
      if (brandName.length > 2 && lower.includes(brandName)) {
        // Double-check it's NOT a trusted domain
        if (!this.trustedDomains.some(trusted => rootLower === trusted || lower.endsWith('.' + trusted))) {
          
          // PASS 2: Check if brand name + suspicious pattern
          if (this._checkBrandSubdomain(hostname, brandName)) {
            result.isImpersonation = true;
            result.brand = brandName;
            result.confidence = 0.95;
            result.riskLevel = 'critical';
            result.reasons.push(`Brand "${brandName}" in subdomain chain`);
            return result;
          }

          if (this._checkBrandWithPhishing(hostname, brandName)) {
            result.isImpersonation = true;
            result.brand = brandName;
            result.confidence = 0.9;
            result.riskLevel = 'critical';
            result.reasons.push(`Brand "${brandName}" with phishing keywords`);
            return result;
          }

          if (this._checkBrandSimilarity(rootDomain, brandName)) {
            result.isImpersonation = true;
            result.brand = brandName;
            result.confidence = 0.85;
            result.riskLevel = 'high';
            result.reasons.push(`Domain similar to brand "${brandName}"`);
            return result;
          }
        }
      }

      // PASS 3: Similarity check even without brand name
      const similarity = this._calculateSimilarity(brandName, rootDomain);
      if (similarity > 0.80) {
        result.isImpersonation = true;
        result.brand = brandName;
        result.confidence = similarity;
        result.riskLevel = similarity > 0.90 ? 'critical' : 'high';
        result.reasons.push(`High similarity to "${brandName}" (${(similarity * 100).toFixed(0)}%)`);
        return result;
      }
    }

    return result;
  }

  _checkBrandSubdomain(hostname, brandName) {
    // Patterns like: paypal.secure-login.com, amazon.verify.com
    const parts = hostname.split('.');
    if (parts.length < 3) return false;

    const subdomainPart = parts.slice(0, -2).join('.');
    return subdomainPart.toLowerCase().includes(brandName);
  }

  _checkBrandWithPhishing(hostname, brandName) {
    const phishingKeywords = [
      'login', 'signin', 'verify', 'confirm', 'secure',
      'account', 'password', 'update', 'authenticate'
    ];

    const lower = hostname.toLowerCase();
    return phishingKeywords.some(kw => lower.includes(kw));
  }

  _checkBrandSimilarity(domain, brandName) {
    const extracted = this._extractSLD(domain);
    const similarity = this._calculateSimilarity(brandName, extracted);
    return similarity > 0.75 && similarity < 0.99;
  }

  _extractSLD(domain) {
    // Simple extraction - just get the domain name without TLD
    const parts = domain.split('.');
    return parts[parts.length - 2] || parts[0];
  }

  _calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this._levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  _levenshteinDistance(s1, s2) {
    const costs = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }

    return costs[s2.length];
  }

  /**
   * Get list of suspicious domains similar to a brand
   * @param {string} brandName - Brand name to check
   * @returns {array} List of similar domain suggestions for blocklisting
   */
  generateSuspiciousDomainPatterns(brandName) {
    const patterns = [];

    // Add typosquatting variations
    for (let i = 0; i < brandName.length; i++) {
      // Character substitution
      const char = brandName[i];
      const substitutions = this._getCharacterSubstitutions(char);

      for (const sub of substitutions) {
        patterns.push(
          brandName.substring(0, i) + sub + brandName.substring(i + 1)
        );
      }
    }

    // Add common suffixes
    const suffixes = ['.com.secure', '.login.net', '.verify.net', '.secure-login.com'];
    for (const suffix of suffixes) {
      patterns.push(brandName + suffix);
    }

    return patterns;
  }

  _getCharacterSubstitutions(char) {
    const map = {
      'o': ['0'],
      'i': ['1', '!'],
      'e': ['3'],
      'a': ['@'],
      's': ['5', '$'],
      'l': ['1', '|'],
      'g': ['9'],
      'b': ['8'],
      't': ['7']
    };

    return map[char.toLowerCase()] || [];
  }
}

export default new BrandDetector();
