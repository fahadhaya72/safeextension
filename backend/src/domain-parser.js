/**
 * Domain Parser with Public Suffix List
 * Properly extracts root domain, subdomain, and hostname components
 */

// Comprehensive public suffix list (most common TLDs and multi-part suffixes)
const PUBLIC_SUFFIXES = {
  // Generic TLDs
  'com': true, 'org': true, 'net': true, 'edu': true, 'gov': true,
  'mil': true, 'int': true, 'info': true, 'biz': true, 'name': true,
  'pro': true, 'mobi': true, 'asia': true, 'tel': true, 'travel': true,
  
  // New gTLDs (sample)
  'xyz': true, 'top': true, 'click': true, 'download': true, 'loan': true,
  'racing': true, 'win': true, 'party': true, 'trade': true, 'webcam': true,
  'date': true, 'review': true, 'science': true, 'stream': true, 'men': true,
  'gq': true, 'tk': true, 'ml': true, 'ga': true, 'cf': true,
  'rest': true, 'app': true, 'dev': true, 'io': true, 'tech': true,
  
  // Country code TLDs
  'uk': true, 'us': true, 'ca': true, 'au': true, 'de': true, 'fr': true,
  'it': true, 'es': true, 'br': true, 'in': true, 'jp': true, 'cn': true,
  'ru': true, 'mx': true, 'nl': true, 'be': true, 'ch': true, 'se': true,
  'no': true, 'dk': true, 'fi': true, 'pl': true, 'ie': true, 'nz': true,
  'za': true, 'sg': true, 'hk': true, 'kr': true, 'tw': true, 'th': true,
  'ph': true, 'vn': true, 'id': true, 'my': true, 'ng': true, 'eg': true,
  
  // Multi-part suffixes (second-level country code TLDs)
  'co.uk': true, 'com.au': true, 'co.in': true, 'co.jp': true, 'co.nz': true,
  'co.za': true, 'com.br': true, 'com.mx': true, 'co.kr': true, 'cn.com': true,
  'ac.uk': true, 'gov.uk': true, 'org.uk': true, 'co.il': true, 'co.th': true,
  'go.jp': true, 'or.jp': true, 'co.id': true, 'gov.au': true, 'edu.au': true,
  'asn.au': true, 'com.ar': true, 'gov.ar': true, 'co.tz': true, 'ac.tz': true
};

export function getDomainParts(hostname) {
  if (!hostname) return { root: null, subdomain: '', protocol: null };
  
  try {
    const parts = hostname.toLowerCase().split('.');
    
    // Check for public suffix match (last 2 parts or more)
    let rootDomain = null;
    let suffixLength = 1;
    
    // Check if last 2 parts match a suffix (e.g., co.uk)
    if (parts.length >= 2) {
      const twoPartSuffix = parts.slice(-2).join('.');
      if (PUBLIC_SUFFIXES[twoPartSuffix]) {
        suffixLength = 2;
      }
    }
    
    // Extract root domain (second-level + suffix)
    if (parts.length >= suffixLength + 1) {
      rootDomain = parts.slice(-(suffixLength + 1)).join('.');
    } else if (parts.length === suffixLength) {
      rootDomain = parts.join('.');
    }
    
    // Extract subdomain (everything before root)
    const subdomainParts = parts.slice(0, parts.length - (suffixLength + 1));
    const subdomain = subdomainParts.length > 0 ? subdomainParts.join('.') : '';
    
    return {
      root: rootDomain,
      subdomain: subdomain,
      hostname: hostname,
      parts: parts,
      partCount: parts.length
    };
  } catch (err) {
    return { root: null, subdomain: '', hostname: hostname, partCount: 0 };
  }
}

export function extractSLD(hostname) {
  // Second-level domain (the main part before TLD)
  const parts = hostname.toLowerCase().split('.');
  if (parts.length >= 2) {
    return parts[parts.length - 2]; // Return just the SLD without TLD
  }
  return parts[0];
}

export function isValidHostname(hostname) {
  if (!hostname || hostname.length < 3) return false;
  // Allow alphanumeric, dots, hyphens
  return /^[a-z0-9.-]+$/i.test(hostname);
}
