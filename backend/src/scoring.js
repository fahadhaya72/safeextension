// Scoring logic (Risk-based assessment, not malware detection)
// Base score = 100
// Deductions:
// - No HTTPS → −20
// - Domain age < 6 months → −25
// - Domain looks like IP obfuscation (e.g., 125.0.0.1.com) → −40
// - Listed in phishing/malware feeds → −50
// - Suspicious URL keywords → −15
// - Excessive redirects (>3) → −10
// Final score = 100 − total deductions, clamped to [0, 100]

const SUSPICIOUS_KEYWORDS = [
  'login', 'verify', 'update', 'secure', 'bank', 'account', 'paypal', 'free', 'bonus', 'win', 'prize'
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

export function computeScore(factors) {
  let deductions = 0;
  const reasons = [];

  if (factors.noHttps) { deductions += 20; reasons.push({ code: 'NO_HTTPS', points: 20 }); }
  if (factors.youngDomain) { deductions += 25; reasons.push({ code: 'YOUNG_DOMAIN', points: 25 }); }
  if (factors.ipObfuscation) { deductions += 40; reasons.push({ code: 'IP_OBFUSCATION', points: 40 }); }
  if (factors.listedInFeeds) { deductions += 50; reasons.push({ code: 'LISTED_IN_FEEDS', points: 50 }); }
  if (factors.suspiciousKeywords) { deductions += 15; reasons.push({ code: 'SUSPICIOUS_KEYWORDS', points: 15 }); }
  if (factors.excessiveRedirects) { deductions += 10; reasons.push({ code: 'EXCESSIVE_REDIRECTS', points: 10 }); }

  const score = Math.max(0, Math.min(100, 100 - deductions));
  let classification = 'safe';
  if (score < 50) classification = 'danger';
  else if (score < 80) classification = 'warning';

  return { score, classification, reasons };
}

export function classify(score) {
  // Interpret score as a safety score: higher is safer.
  // >80 → allow, 50–80 → warn, <50 → block
  if (score > 80) return 'allow';
  if (score >= 50) return 'warn';
  return 'block';
}

export function hasSuspiciousKeywords(url) {
  const lower = url.toLowerCase();
  return SUSPICIOUS_KEYWORDS.some(k => lower.includes(k));
}
