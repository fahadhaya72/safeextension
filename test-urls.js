#!/usr/bin/env node
/**
 * SafeExtension Security URL Test Suite
 * Tests all 12 categories of URLs against the backend
 */

const apiKey = 'test-api-key-123';
const apiUrl = 'http://localhost:4000/api/extension-check';
const results = [];

// Test URL function
async function testURL(url, category, expected, description) {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Extension-ID': 'web'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const score = data.score;
    const action = data.action;
    const riskClass = data.risk_classification;

    // Determine if test passed
    let passed = false;
    if (expected === 'block' && action === 'block') passed = true;
    else if (expected === 'warn' && action === 'warn') passed = true;
    else if (expected === 'allow' && action === 'allow') passed = true;

    return {
      url,
      category,
      description,
      expected,
      score,
      action,
      risk: riskClass,
      passed,
      error: null
    };
  } catch (err) {
    return {
      url,
      category,
      description,
      expected,
      score: null,
      action: null,
      risk: null,
      passed: false,
      error: err.message
    };
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('SafeExtension Security URL Test Suite');
  console.log('========================================\n');

  // 1. HOMOGRAPH / PUNYCODE ATTACKS
  console.log('[1] Testing Homograph / Punycode Attacks...');
  const punyTests = [
    { url: 'https://xn--pple-43d.com', desc: 'Punycode Apple spoof' },
    { url: 'https://xn--googl-fsa.com', desc: 'Punycode Google spoof' }
  ];
  for (const test of punyTests) {
    results.push(await testURL(test.url, 'Homograph', 'block', test.desc));
  }

  // 2. BRAND SPOOFING + SUBDOMAIN TRICKS
  console.log('[2] Testing Brand Spoofing and Subdomain Tricks...');
  const brandTests = [
    { url: 'https://paypal.secure-login.com', desc: 'PayPal subdomain trick' },
    { url: 'https://google.account.verify-login.net', desc: 'Google subdomain trick' },
    { url: 'https://amazon.login.security-check.co', desc: 'Amazon subdomain trick' },
    { url: 'https://facebook.verify-user-access.com', desc: 'Facebook subdomain trick' }
  ];
  for (const test of brandTests) {
    results.push(await testURL(test.url, 'Brand Spoofing', 'block', test.desc));
  }

  // 3. CHARACTER SUBSTITUTION ATTACKS
  console.log('[3] Testing Character Substitution Attacks...');
  const charTests = [
    { url: 'https://paypa1.com', desc: 'PayPal with 1 instead of l' },
    { url: 'https://g00gle.com', desc: 'Google with 0s instead of o' },
    { url: 'https://micr0soft-login.com', desc: 'Microsoft with 0 instead of O' },
    { url: 'https://faceb00k-security.net', desc: 'Facebook with 00 instead of oo' }
  ];
  for (const test of charTests) {
    results.push(await testURL(test.url, 'Character Substitution', 'block', test.desc));
  }

  // 4. URL SHORTENERS
  console.log('[4] Testing URL Shorteners...');
  const shortenerTests = [
    { url: 'https://bit.ly/3example', desc: 'Bit.ly shortener' },
    { url: 'https://tinyurl.com/example123', desc: 'TinyURL shortener' },
    { url: 'https://t.co/example', desc: 'Twitter shortener' }
  ];
  for (const test of shortenerTests) {
    results.push(await testURL(test.url, 'URL Shortener', 'warn', test.desc));
  }

  // 5. LONG AND OBFUSCATED URLS
  console.log('[5] Testing Long and Obfuscated URLs...');
  const longTests = [
    { url: 'https://secure-login-account-verification-update-user-info-paypal.com/login/verify/session/update/index.php?id=123456789', desc: 'Extremely long obfuscated URL' }
  ];
  for (const test of longTests) {
    results.push(await testURL(test.url, 'Long URL', 'warn', test.desc));
  }

  // 6. IP-BASED URLS
  console.log('[6] Testing IP-Based URLs...');
  const ipTests = [
    { url: 'http://192.168.1.1/login', desc: 'Private IPv4' },
    { url: 'http://185.199.110.153/secure-login', desc: 'Public IPv4' }
  ];
  for (const test of ipTests) {
    results.push(await testURL(test.url, 'IP URL', 'warn', test.desc));
  }

  // 7. JAVASCRIPT AND DATA URLS
  console.log('[7] Testing JavaScript and Data URLs...');
  const jsTests = [
    { url: 'javascript:alert(document.cookie)', desc: 'JavaScript URL' },
    { url: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', desc: 'Data URL' }
  ];
  for (const test of jsTests) {
    results.push(await testURL(test.url, 'Code Execution', 'block', test.desc));
  }

  // 8. SUSPICIOUS TLDS
  console.log('[8] Testing Suspicious TLDs...');
  const tldTests = [
    { url: 'https://secure-login.xyz', desc: 'Suspicious XYZ TLD' },
    { url: 'https://paypal-update.top', desc: 'Suspicious TOP TLD' },
    { url: 'https://account-verification.click', desc: 'Suspicious CLICK TLD' },
    { url: 'https://bank-login.gq', desc: 'Suspicious GQ TLD' }
  ];
  for (const test of tldTests) {
    results.push(await testURL(test.url, 'Suspicious TLD', 'block', test.desc));
  }

  // 9. DEEP SUBDOMAIN CHAINS
  console.log('[9] Testing Deep Subdomain Chains...');
  const deepTests = [
    { url: 'https://login.secure.verify.account.google.com.malicious.site', desc: 'Deep subdomain chain with Google' },
    { url: 'https://a.b.c.d.e.f.g.paypal.com.fake-domain.xyz', desc: 'Deep subdomain chain with PayPal' }
  ];
  for (const test of deepTests) {
    results.push(await testURL(test.url, 'Deep Subdomain', 'block', test.desc));
  }

  // 10. LEGITIMATE SITES (FALSE POSITIVE TEST)
  console.log('[10] Testing Legitimate Sites (False Positive Check)...');
  const legTests = [
    { url: 'https://www.google.com', desc: 'Google' },
    { url: 'https://github.com', desc: 'GitHub' },
    { url: 'https://amazon.in', desc: 'Amazon India' },
    { url: 'https://stackoverflow.com', desc: 'Stack Overflow' }
  ];
  for (const test of legTests) {
    results.push(await testURL(test.url, 'Legitimate', 'allow', test.desc));
  }

  // 11. CUSTOM CRAFTED ATTACK
  console.log('[11] Testing Custom Crafted Attacks...');
  const customTests = [
    { url: 'https://paypa1-secure-login-verification-account-update.com', desc: 'Combined: brand spoof + keyword stuffing + substitution' }
  ];
  for (const test of customTests) {
    results.push(await testURL(test.url, 'Custom Attack', 'block', test.desc));
  }

  // Generate Report
  console.log('\n========================================');
  console.log('SECURITY TEST RESULTS REPORT');
  console.log('========================================\n');

  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  const totalCount = results.length;
  const successRate = totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(1) : 0;

  console.log('Test Summary:');
  console.log(`Total Tests: ${totalCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Success Rate: ${successRate}%\n`);

  // Detailed results by category
  console.log('========================================');
  console.log('DETAILED RESULTS BY CATEGORY');
  console.log('========================================\n');

  const byCategory = {};
  results.forEach(r => {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  });

  for (const [category, tests] of Object.entries(byCategory)) {
    console.log(`--- ${category} ---`);
    tests.forEach(result => {
      const status = result.passed ? 'PASS' : 'FAIL';
      console.log(`${status} | ${result.description}`);
      console.log(`  URL: ${result.url}`);
      console.log(`  Expected: ${result.expected}, Got: Score=${result.score}, Action=${result.action}, Risk=${result.risk}`);
      if (result.error) console.log(`  ERROR: ${result.error}`);
      console.log('');
    });
  }

  // Category Summary
  console.log('========================================');
  console.log('RESULTS BY CATEGORY');
  console.log('========================================\n');

  for (const [category, tests] of Object.entries(byCategory)) {
    const catPass = tests.filter(t => t.passed).length;
    const catTotal = tests.length;
    const catRate = catTotal > 0 ? ((catPass / catTotal) * 100).toFixed(1) : 0;
    console.log(`${category}: ${catPass}/${catTotal} (${catRate}%)`);
  }

  // Final verdict
  console.log('\n========================================');
  console.log('SECURITY ASSESSMENT');
  console.log('========================================\n');

  if (failCount === 0) {
    console.log('ALL TESTS PASSED! System is ready for production.');
  } else if ((passCount / totalCount) >= 0.9) {
    console.log('90%+ tests passed. Minor improvements needed.');
  } else {
    console.log('Critical failures detected. System needs major improvements.');
  }

  console.log('\n========================================\n');
}

// Run tests
runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
