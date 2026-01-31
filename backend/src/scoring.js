// Scoring logic (Risk-based assessment, not malware detection)
// Base score = 100
// Deductions:
// - No HTTPS → −20
// - Domain age < 6 months → −25
// - Listed in phishing/malware feeds → −50 (via Safe Browsing or equivalent)
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

export function computeScore(factors) {
  let deductions = 0;
  const reasons = [];

  if (factors.noHttps) { deductions += 20; reasons.push({ code: 'NO_HTTPS', points: 20 }); }
  if (factors.youngDomain) { deductions += 25; reasons.push({ code: 'YOUNG_DOMAIN', points: 25 }); }
  if (factors.listedInFeeds) { deductions += 50; reasons.push({ code: 'LISTED_IN_FEEDS', points: 50 }); }
  if (factors.suspiciousKeywords) { deductions += 15; reasons.push({ code: 'SUSPICIOUS_KEYWORDS', points: 15 }); }
  if (factors.excessiveRedirects) { deductions += 10; reasons.push({ code: 'EXCESSIVE_REDIRECTS', points: 10 }); }

  const score = Math.max(0, Math.min(100, 100 - deductions));
  let classification = 'low';
  if (score >= 50 && score <= 90) classification = 'medium';
  if (score > 90) classification = 'high';

  return { score, classification, reasons };
}

export function classify(score) {
  // Interpret score as a safety score: higher is safer.
  // >90 → allow, 50–90 → warn, <50 → block
  if (score > 90) return 'allow';
  if (score >= 50) return 'warn';
  return 'block';
}

export function hasSuspiciousKeywords(url) {
  const lower = url.toLowerCase();
  return SUSPICIOUS_KEYWORDS.some(k => lower.includes(k));
}
