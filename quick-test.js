// Quick test to verify scoring fixes

async function testURL(url) {
    const response = await fetch('http://localhost:4000/api/check-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });
    
    const result = await response.json();
    console.log(`\n🔍 ${url}`);
    console.log(`   Score: ${result.score}`);
    console.log(`   Action: ${result.action}`);
    console.log(`   Classification: ${result.risk_classification}`);
    console.log(`   Factors: ${result.risk_factors.length}`);
    
    if (result.details?.advanced) {
        console.log(`   Advanced Features: ✅`);
        console.log(`   Brand Impersonation: ${result.details.advanced.brandImpersonation?.detected ? 'Yes' : 'No'}`);
        console.log(`   Geographic Risk: ${result.details.advanced.geographicRisk?.risk || 'None'}`);
        console.log(`   Reputation: ${result.details.advanced.reputation?.level || 'Unknown'}`);
    }
    
    return result;
}

async function runQuickTests() {
    console.log('🚀 Quick Backend Test\n');
    
    // Test safe URLs
    await testURL('https://www.google.com');
    await testURL('https://github.com');
    
    // Test suspicious URLs  
    await testURL('http://example.com');
    await testURL('https://secure-login-verify-account.tk');
    
    // Test dangerous URLs
    await testURL('http://goog1e-login-secure.ml');
    await testURL('https://125.0.0.1.com/paypal-login');
    
    console.log('\n✅ Quick test complete!');
}

runQuickTests().catch(console.error);
