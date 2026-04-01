// Debug Google false positive issue
import { computeAdvancedScore, detectBrandImpersonation, hasSuspiciousKeywords } from './backend/src/scoring.js';

async function debugGoogle() {
  const url = 'https://www.google.com';
  console.log(`🔍 Debugging: ${url}`);
  
  // Test brand impersonation
  const hostname = 'www.google.com';
  console.log('Hostname:', hostname);
  
  const cleanHostname = hostname.toLowerCase().replace(/^www\./, '');
  console.log('Clean Hostname:', cleanHostname);
  
  const brandCheck = detectBrandImpersonation(hostname);
  console.log('Brand Impersonation:', brandCheck);
  
  // Test keywords
  const keywordCheck = hasSuspiciousKeywords(url);
  console.log('Suspicious Keywords:', keywordCheck);
  
  // Test full scoring
  const basicFactors = {
    noHttps: false,
    youngDomain: false,
    listedInFeeds: false,
    suspiciousKeywords: keywordCheck,
    excessiveRedirects: false,
    ipObfuscation: false,
    temporaryService: false,
    suspiciousSubdomain: false
  };
  
  const advancedFactors = {
    brandImpersonation: brandCheck,
    suspiciousTLD: false,
    urlStructure: { score: 0 },
    geographicRisk: { score: 0 },
    certificate: { score: 0 },
    reputation: { score: 0 }
  };
  
  const result = computeAdvancedScore(basicFactors, advancedFactors);
  console.log('Final Result:', result);
}

debugGoogle().catch(console.error);
