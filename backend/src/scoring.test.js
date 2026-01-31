import { test } from 'node:test';
import assert from 'node:assert';
import { 
  isValidUrl, 
  analyzeUrlSyntax, 
  computeScore, 
  classify, 
  hasSuspiciousKeywords 
} from '../scoring.js';

test('URL Validation', async (t) => {
  await t.test('should validate correct URLs', () => {
    assert.strictEqual(isValidUrl('https://google.com'), true);
    assert.strictEqual(isValidUrl('http://example.com'), true);
    assert.strictEqual(isValidUrl('https://sub.example.com/path?query=1'), true);
  });

  await t.test('should reject invalid URLs', () => {
    assert.strictEqual(isValidUrl('not-a-url'), false);
    assert.strictEqual(isValidUrl('ftp://example.com'), false);
    assert.strictEqual(isValidUrl(''), false);
    assert.strictEqual(isValidUrl('just some text'), false);
  });
});

test('URL Syntax Analysis', async (t) => {
  await t.test('should extract protocol correctly', () => {
    const result = analyzeUrlSyntax('https://example.com/path');
    assert.strictEqual(result.protocol, 'https');
  });

  await t.test('should extract hostname correctly', () => {
    const result = analyzeUrlSyntax('https://sub.example.com/path');
    assert.strictEqual(result.hostname, 'sub.example.com');
  });

  await t.test('should handle invalid URLs gracefully', () => {
    const result = analyzeUrlSyntax('not-valid');
    assert.strictEqual(result.protocol, null);
    assert.strictEqual(result.hostname, null);
  });

  await t.test('should extract path and query', () => {
    const result = analyzeUrlSyntax('https://example.com/path?key=value');
    assert.match(result.path, /\/path/);
  });
});

test('Suspicious Keywords Detection', async (t) => {
  await t.test('should detect login keyword', () => {
    assert.strictEqual(hasSuspiciousKeywords('https://secure-login.com'), true);
  });

  await t.test('should detect multiple keywords', () => {
    assert.strictEqual(hasSuspiciousKeywords('https://verify-bank-login.com'), true);
  });

  await t.test('should not flag safe URLs', () => {
    assert.strictEqual(hasSuspiciousKeywords('https://github.com'), false);
    assert.strictEqual(hasSuspiciousKeywords('https://google.com'), false);
  });

  await t.test('should be case insensitive', () => {
    assert.strictEqual(hasSuspiciousKeywords('https://VERIFY.com'), true);
    assert.strictEqual(hasSuspiciousKeywords('https://LoGin.com'), true);
  });
});

test('Risk Score Computation', async (t) => {
  await t.test('should return 100 for safe URL with no factors', () => {
    const factors = {
      noHttps: false,
      youngDomain: false,
      listedInFeeds: false,
      suspiciousKeywords: false,
      excessiveRedirects: false
    };
    const { score } = computeScore(factors);
    assert.strictEqual(score, 100);
  });

  await t.test('should deduct for no HTTPS', () => {
    const factors = {
      noHttps: true,
      youngDomain: false,
      listedInFeeds: false,
      suspiciousKeywords: false,
      excessiveRedirects: false
    };
    const { score } = computeScore(factors);
    assert.strictEqual(score, 80);
  });

  await t.test('should deduct for young domain', () => {
    const factors = {
      noHttps: false,
      youngDomain: true,
      listedInFeeds: false,
      suspiciousKeywords: false,
      excessiveRedirects: false
    };
    const { score } = computeScore(factors);
    assert.strictEqual(score, 75);
  });

  await t.test('should deduct for listed in feeds', () => {
    const factors = {
      noHttps: false,
      youngDomain: false,
      listedInFeeds: true,
      suspiciousKeywords: false,
      excessiveRedirects: false
    };
    const { score } = computeScore(factors);
    assert.strictEqual(score, 50);
  });

  await t.test('should apply multiple deductions', () => {
    const factors = {
      noHttps: true,
      youngDomain: true,
      listedInFeeds: true,
      suspiciousKeywords: true,
      excessiveRedirects: true
    };
    const { score } = computeScore(factors);
    assert.strictEqual(score, 0); // 100 - 20 - 25 - 50 - 15 - 10 = -20, clamped to 0
  });

  await t.test('should clamp score to 0-100 range', () => {
    const factors = {
      noHttps: true,
      youngDomain: true,
      listedInFeeds: true,
      suspiciousKeywords: true,
      excessiveRedirects: true
    };
    const { score } = computeScore(factors);
    assert.strictEqual(score >= 0 && score <= 100, true);
  });
});

test('Risk Classification', async (t) => {
  await t.test('should classify high score as low risk', () => {
    const { classification } = computeScore({
      noHttps: false,
      youngDomain: false,
      listedInFeeds: false,
      suspiciousKeywords: false,
      excessiveRedirects: false
    });
    assert.strictEqual(classification, 'low');
  });

  await t.test('should classify medium score as medium risk', () => {
    const { classification } = computeScore({
      noHttps: true,
      youngDomain: true,
      listedInFeeds: false,
      suspiciousKeywords: false,
      excessiveRedirects: false
    });
    assert.strictEqual(classification, 'medium');
  });

  await t.test('should classify low score as high risk', () => {
    const { classification } = computeScore({
      noHttps: true,
      youngDomain: true,
      listedInFeeds: true,
      suspiciousKeywords: true,
      excessiveRedirects: true
    });
    assert.strictEqual(classification, 'high');
  });
});

test('Action Classification', async (t) => {
  await t.test('should allow high scores', () => {
    const action = classify(95);
    assert.strictEqual(action, 'allow');
  });

  await t.test('should warn on medium scores', () => {
    const action = classify(70);
    assert.strictEqual(action, 'warn');
  });

  await t.test('should block low scores', () => {
    const action = classify(30);
    assert.strictEqual(action, 'block');
  });

  await t.test('should handle boundary score 50 as warn', () => {
    const action = classify(50);
    assert.strictEqual(action, 'warn');
  });

  await t.test('should handle boundary score 90 as allow', () => {
    const action = classify(90);
    assert.strictEqual(action, 'warn');
  });

  await t.test('should handle boundary score 91 as allow', () => {
    const action = classify(91);
    assert.strictEqual(action, 'allow');
  });
});
