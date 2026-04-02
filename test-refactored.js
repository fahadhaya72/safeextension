/**
 * Comprehensive Security Test Suite for Refactored Detection Engine
 * Tests all attack vectors against new rule engine + scoring
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api';
const API_KEY = process.env.SAFEEXTENSION_API_KEY || 'test-key-123';
const EXTENSION_ID = 'web';

// Test categories
const TEST_SUITES = {
  'Homograph Attacks': [
    { url: 'https://xn--pple-43d.com', shouldBe: 'block', why: 'Punycode homograph' },
    { url: 'https://xn--80akhbyknj4f.com', shouldBe: 'block', why: 'Cyrillic homograph' }
  ],
  
  'Brand Spoofing': [
    { url: 'https://paypal.secure-login.com', shouldBe: 'block', why: 'Brand in subdomain' },
    { url: 'https://amazon.verify.net', shouldBe: 'block', why: 'Brand + verify keyword' },
    { url: 'https://app-amazon-account-verify.com', shouldBe: 'block', why: 'Brand-like with phishing' },
    { url: 'https://banking.secure-account.com', shouldBe: 'block', why: 'Phishing keywords' }
  ],
  
  'Character Substitution': [
    { url: 'https://paypa1.com', shouldBe: 'block', why: 'Typosquatting (paypa1 vs paypal)' },
    { url: 'https://g00gle.com', shouldBe: 'block', why: 'Character substitution (0 for o)' },
    { url: 'https://m1crosoft.com', shouldBe: 'block', why: 'Character substitution (1 for i)' },
    { url: 'https://fac3book.com', shouldBe: 'block', why: 'Character substitution (3 for e)' }
  ],
  
  'URL Shorteners': [
    { url: 'https://bit.ly/malware123', shouldBe: 'warn', why: 'URL shortener hides destination' },
    { url: 'https://tinyurl.com/suspicious', shouldBe: 'warn', why: 'TinyURL shortener' },
    { url: 'https://goo.gl/phishing', shouldBe: 'warn', why: 'Google shortener abuse' }
  ],
  
  'Long URLs': [
    { url: 'https://example.com/' + 'a'.repeat(200) + '?param=value', shouldBe: 'warn', why: 'Excessively long URL' },
    { url: 'https://example.com?a=1&b=2&c=3&d=4&e=5&f=6&g=7&h=8&i=9&j=10&k=11', shouldBe: 'warn', why: 'Too many parameters' }
  ],
  
  'IP-Based URLs': [
    { url: 'https://192.168.1.1:8080/admin', shouldBe: 'warn', why: 'IP-based URL' },
    { url: 'https://127.0.0.1', shouldBe: 'warn', why: 'Localhost IP' }
  ],
  
  'Suspicious TLDs': [
    { url: 'https://google-login.xyz', shouldBe: 'warn', why: 'Suspicious TLD (.xyz)' },
    { url: 'https://paypal-verify.tk', shouldBe: 'block', why: 'Suspicious TLD + brand' },
    { url: 'https://secure-amazon.click', shouldBe: 'block', why: 'Suspicious TLD + phishing' }
  ],
  
  'Deep Subdomains': [
    { url: 'https://a.b.c.d.e.com', shouldBe: 'warn', why: 'Deep subdomain chain (5 levels)' },
    { url: 'https://verify.update.secure.account.bank.xyz', shouldBe: 'block', why: 'Very deep + phishing' }
  ],
  
  'Legitimate Sites': [
    { url: 'https://google.com', shouldBe: 'allow', why: 'Legitimate domain' },
    { url: 'https://www.paypal.com', shouldBe: 'allow', why: 'Official PayPal' },
    { url: 'https://github.com/user/repo', shouldBe: 'allow', why: 'Legitimate GitHub' },
    { url: 'https://stackoverflow.com/questions/123', shouldBe: 'allow', why: 'Legitimate SO' }
  ],
  
  'Custom Attack Patterns': [
    { url: 'https://google.com.loginverify.xyz', shouldBe: 'block', why: 'Legitimate domain buried + phishing' },
    { url: 'javascript:alert("xss")', shouldBe: 'block', why: 'JavaScript URL' },
    { url: 'data:text/html,<script>alert(1)</script>', shouldBe: 'block', why: 'Data URL (code execution)' }
  ]
};

// Test execution
async function runTests() {
  console.log('🔒 SAFE EXTENSION - REFACTORED ENGINE TEST SUITE\n');
  console.log('='.repeat(70));
  
  let totalTests = 0;
  let passedTests = 0;
  const results = {};

  for (const [category, tests] of Object.entries(TEST_SUITES)) {
    console.log(`\n📁 ${category}`);
    console.log('-'.repeat(70));
    
    results[category] = { passed: 0, failed: 0, tests: [] };
    
    for (const test of tests) {
      totalTests++;
      
      try {
        const response = await fetch(`${BASE_URL}/extension-check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            'X-Extension-ID': EXTENSION_ID
          },
          body: JSON.stringify({ url: test.url })
        });

        if (response.status === 429) {
          console.log(`  ⏸️  RATE LIMITED - Waiting...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        const data = await response.json();
        const actualAction = data.action;
        const expectedAction = test.shouldBe;
        const passed = actualAction === expectedAction;

        if (passed) {
          passedTests++;
          results[category].passed++;
          console.log(`  ✅ PASS: ${test.url.substring(0, 50)}`);
          console.log(`     Expected: ${expectedAction}, Got: ${actualAction} (Score: ${data.score})`);
        } else {
          results[category].failed++;
          console.log(`  ❌ FAIL: ${test.url.substring(0, 50)}`);
          console.log(`     Expected: ${expectedAction}, Got: ${actualAction} (Score: ${data.score})`);
          console.log(`     Reason: ${test.why}`);
          console.log(`     Detection: ${data.reasons.join(', ')}`);
        }

        results[category].tests.push({
          url: test.url,
          expected: expectedAction,
          actual: actualAction,
          passed,
          score: data.score,
          reasons: data.reasons
        });

        // Rate limit: 1 request per 100ms
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        results[category].failed++;
        console.log(`  ⚠️  ERROR: ${test.url.substring(0, 50)}`);
        console.log(`     ${err.message}`);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  
  for (const [category, result] of Object.entries(results)) {
    const total = result.passed + result.failed;
    const percentage = total > 0 ? Math.round((result.passed / total) * 100) : 0;
    const status = percentage === 100 ? '✅' : percentage >= 75 ? '⚠️ ' : '❌';
    console.log(`${status} ${category}: ${result.passed}/${total} (${percentage}%)`);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`OVERALL: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! System is production-ready.');
  } else if (passedTests >= totalTests * 0.95) {
    console.log('✨ Excellent results (95%+ pass rate)');
  } else if (passedTests >= totalTests * 0.85) {
    console.log('🔧 Good progress (85%+ pass rate) - Minor fixes needed');
  } else {
    console.log('⚡ Further fixes required');
  }
  
  console.log('='.repeat(70));
}

// Run tests
runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
