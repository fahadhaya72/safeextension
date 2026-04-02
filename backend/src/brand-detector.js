/**
 * Brand Detection Module
 * Detects brand impersonation with similarity scoring
 */

// Official brand domains whitelist
const OFFICIAL_BRANDS = {
  'google': {
    domains: ['google.com', 'google.co.uk', 'google.in', 'google.fr', 'google.de'],
    keywords: ['google.com'],
    tlds: ['com']
  },
  'paypal': {
    domains: ['paypal.com', 'paypal.co.uk', 'paypal.de'],
    keywords: ['paypal'],
    tlds: ['com']
  },
  'amazon': {
    domains: ['amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de', 'amazon.fr'],
    keywords: ['amazon'],
    tlds: ['com']
  },
  'facebook': {
    domains: ['facebook.com', 'fb.com'],
    keywords: ['facebook'],
    tlds: ['com']
  },
  'microsoft': {
    domains: ['microsoft.com', 'outlook.com', 'live.com'],
    keywords: ['microsoft', 'outlook'],
    tlds: ['com']
  },
  'apple': {
    domains: ['apple.com', 'icloud.com'],
    keywords: ['apple'],
    tlds: ['com']
  },
  'github': {
    domains: ['github.com'],
    keywords: ['github'],
    tlds: ['com']
  },
  'linkedin': {
    domains: ['linkedin.com'],
    keywords: ['linkedin'],
    tlds: ['com']
  },
  'twitter': {
    domains: ['twitter.com', 'x.com'],
    keywords: ['twitter'],
    tlds: ['com']
  },
  'spotify': {
    domains: ['spotify.com'],
    keywords: ['spotify'],
    tlds: ['com']
  }
};

export class BrandDetector {
  constructor() {
    this.brands = OFFICIAL_BRANDS;
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

    // Check each known brand
    for (const [brandName, brandInfo] of Object.entries(this.brands)) {
      // PASS 1: Check if it's an official domain
      if (brandInfo.domains.some(d => rootLower === d)) {
        continue; // This is legitimate
      }

      // PASS 2: Check if brand name + suspicious pattern
      if (lower.includes(brandName)) {
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
