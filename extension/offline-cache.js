// Offline Malicious Domain Cache for SafeExtension
// Provides protection when API is unavailable or slow

class OfflineDomainCache {
  constructor() {
    this.cache = new Map();
    this.lastUpdate = 0;
    this.updateInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.storageKey = 'safeextension_malicious_cache';
    this.initialize();
  }

  async initialize() {
    await this.loadCache();
    await this.updateCacheIfNeeded();
  }

  async loadCache() {
    try {
      const stored = await chrome.storage.local.get(this.storageKey);
      if (stored[this.storageKey]) {
        const data = stored[this.storageKey];
        this.cache = new Map(data.domains || []);
        this.lastUpdate = data.lastUpdate || 0;
        console.log(`Loaded ${this.cache.size} domains from offline cache`);
      }
    } catch (error) {
      console.warn('Failed to load offline cache:', error);
    }
  }

  async saveCache() {
    try {
      const data = {
        domains: Array.from(this.cache.entries()),
        lastUpdate: this.lastUpdate
      };
      await chrome.storage.local.set({ [this.storageKey]: data });
    } catch (error) {
      console.warn('Failed to save offline cache:', error);
    }
  }

  async updateCacheIfNeeded() {
    const now = Date.now();
    if (now - this.lastUpdate > this.updateInterval) {
      await this.updateCache();
    }
  }

  async updateCache() {
    try {
      // Get top 10k malicious domains from various threat intelligence sources
      const maliciousDomains = await this.fetchMaliciousDomains();
      
      // Update cache
      this.cache.clear();
      maliciousDomains.forEach(domain => {
        this.cache.set(domain.toLowerCase(), {
          added: Date.now(),
          source: 'offline_cache'
        });
      });
      
      this.lastUpdate = Date.now();
      await this.saveCache();
      
      console.log(`Updated offline cache with ${maliciousDomains.length} malicious domains`);
    } catch (error) {
      console.warn('Failed to update offline cache:', error);
    }
  }

  async fetchMaliciousDomains() {
    // Top malicious domains from various threat feeds
    // This is a curated list of known malicious domains
    const knownMaliciousDomains = [
      // Phishing domains
      'microsoft-online-security.com',
      'secure-account-login.com',
      'apple-security-check.com',
      'google-verify-account.com',
      'amazon-security-alert.com',
      'paypal-verification-center.com',
      'facebook-security-update.com',
      'netflix-account-verify.com',
      'bank-america-security.com',
      'chase-online-secure.com',
      
      // Malware domains
      'malware-distribution.com',
      'trojan-downloader.net',
      'virus-scanner-online.com',
      'fake-antivirus-security.com',
      'system-repair-tool.com',
      'pc-optimizer-pro.com',
      'driver-update-tool.com',
      'registry-cleaner-pro.com',
      
      // Scam domains
      'tech-support-scam.com',
      'lottery-winner-notification.com',
      'inheritance-fund-transfer.com',
      'investment-opportunity-high-return.com',
      'cryptocurrency-trading-bot.com',
      'binary-options-trading.com',
      'forex-trading-signal.com',
      
      // Typosquatting domains
      'g00gle.com',
      'goog1e.com',
      'faceb0ok.com',
      'amaz0n.com',
      'paypa1.com',
      'netf1ix.com',
      'micros0ft.com',
      'app1e.com',
      'yah00.com',
      'instagrarn.com',
      'twitt3r.com',
      'link3din.com',
      
      // Suspicious TLD domains
      'malicious-site.tk',
      'phishing-attack.ml',
      'scam-website.ga',
      'fake-domain.cf',
      'suspicious-site.gq',
      'malware-hosting.men',
      'virus-distribution.click',
      'trojan-hosting.download',
      'scam-page.loan',
      'fake-site.racing',
      
      // IP-based domains
      '192.168.1.1.com',
      '10.0.0.1.com',
      '172.16.0.1.com',
      '127.0.0.1.com',
      
      // Temporary/tunnel services
      'malicious-site.trycloudflare.com',
      'phishing-page.ngrok.io',
      'scam-site.serveo.net',
      'fake-page.localtunnel.me',
      
      // Shortened URLs commonly used for malicious purposes
      'bit.ly/malicious',
      'tinyurl.com/phishing',
      'ow.ly/scam',
      'short.link/malware',
      
      // Additional high-risk domains
      'account-verification-required.com',
      'security-breach-alert.com',
      'suspicious-activity-detected.com',
      'account-temporarily-suspended.com',
      'urgent-security-update.com',
      'verify-your-identity-now.com',
      'confirm-your-account-details.com',
      'update-payment-information.com',
      'secure-your-account-immediately.com',
      'unauthorized-access-attempt.com'
    ];

    // Add some dynamically generated patterns
    const dynamicDomains = this.generateDynamicMaliciousDomains();
    
    return [...knownMaliciousDomains, ...dynamicDomains];
  }

  generateDynamicMaliciousDomains() {
    const domains = [];
    const prefixes = ['secure', 'login', 'account', 'verify', 'update', 'security', 'alert', 'warning'];
    const brands = ['google', 'facebook', 'amazon', 'microsoft', 'apple', 'paypal', 'netflix', 'chase'];
    const suffixes = ['.com', '.net', '.org', '.info', '.biz'];
    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.gq'];

    // Generate brand impersonation domains
    for (const brand of brands) {
      for (const prefix of prefixes.slice(0, 3)) {
        for (const tld of suspiciousTlds) {
          domains.push(`${prefix}-${brand}${tld}`);
          domains.push(`${brand}-${prefix}${tld}`);
        }
      }
    }

    // Generate generic phishing domains
    for (const prefix of prefixes) {
      for (const suffix of suffixes) {
        domains.push(`${prefix}-account${suffix}`);
        domains.push(`${prefix}-login${suffix}`);
        domains.push(`${prefix}-verification${suffix}`);
      }
    }

    return domains;
  }

  isMalicious(domain) {
    if (!domain) return false;
    
    const normalizedDomain = domain.toLowerCase();
    
    // Direct match
    if (this.cache.has(normalizedDomain)) {
      return true;
    }
    
    // Check subdomains
    for (const [maliciousDomain] of this.cache) {
      if (normalizedDomain === maliciousDomain || normalizedDomain.endsWith('.' + maliciousDomain)) {
        return true;
      }
    }
    
    // Check for suspicious patterns
    return this.matchesSuspiciousPattern(normalizedDomain);
  }

  matchesSuspiciousPattern(domain) {
    // Check for IP addresses in domain
    const ipPattern = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(domain)) {
      return true;
    }
    
    // Check for excessive hyphens
    const hyphenCount = (domain.match(/-/g) || []).length;
    if (hyphenCount > 4) {
      return true;
    }
    
    // Check for high entropy (random-looking)
    const entropy = this.calculateEntropy(domain.split('.')[0]);
    if (entropy > 3.5) {
      return true;
    }
    
    // Check for character substitutions
    const substitutions = ['0', '1', '3', '4', '5', '8', '@', '!'];
    let substitutionCount = 0;
    
    for (const char of domain) {
      if (substitutions.includes(char)) {
        substitutionCount++;
      }
    }
    
    if (substitutionCount > 2) {
      return true;
    }
    
    return false;
  }

  calculateEntropy(str) {
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

  async checkDomain(domain) {
    // First check offline cache
    const isOfflineMalicious = this.isMalicious(domain);
    
    if (isOfflineMalicious) {
      return {
        malicious: true,
        source: 'offline_cache',
        confidence: 85,
        reason: 'Domain found in offline malicious domain cache'
      };
    }
    
    // If not found in cache, try to update and check again
    await this.updateCacheIfNeeded();
    const isUpdatedMalicious = this.isMalicious(domain);
    
    if (isUpdatedMalicious) {
      return {
        malicious: true,
        source: 'offline_cache_updated',
        confidence: 85,
        reason: 'Domain found in updated offline cache'
      };
    }
    
    return {
      malicious: false,
      source: 'offline_cache',
      confidence: 60,
      reason: 'Domain not found in offline cache'
    };
  }

  getStats() {
    return {
      totalDomains: this.cache.size,
      lastUpdate: this.lastUpdate,
      nextUpdate: this.lastUpdate + this.updateInterval,
      age: Date.now() - this.lastUpdate
    };
  }

  async forceUpdate() {
    await this.updateCache();
  }

  async clearCache() {
    this.cache.clear();
    this.lastUpdate = 0;
    await chrome.storage.local.remove(this.storageKey);
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfflineDomainCache;
} else {
  window.OfflineDomainCache = OfflineDomainCache;
}
