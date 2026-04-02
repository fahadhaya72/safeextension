# SafeExtension Security URL Test Suite
# Tests all 12 categories of URLs against the backend

$apiKey = "test-api-key-123"
$apiUrl = "http://localhost:4000/api/extension-check"
$results = @()

function Test-URL {
    param(
        [string]$url,
        [string]$category,
        [string]$expected,
        [string]$description
    )
    
    try {
        $body = @{ url = $url } | ConvertTo-Json
        $response = Invoke-WebRequest -Uri $apiUrl -Method POST -ContentType "application/json" `
            -Headers @{"X-API-Key" = $apiKey; "X-Extension-ID" = "web"} `
            -Body $body -UseBasicParsing
        
        $data = $response.Content | ConvertFrom-Json
        $score = $data.score
        $action = $data.action
        $riskClass = $data.risk_classification
        
        # Determine if test passed
        $passed = $false
        if ($expected -eq "block" -and $action -eq "block") { $passed = $true }
        elseif ($expected -eq "warn" -and $action -eq "warn") { $passed = $true }
        elseif ($expected -eq "allow" -and $action -eq "allow") { $passed = $true }
        
        return @{
            URL = $url
            Category = $category
            Description = $description
            Expected = $expected
            Score = $score
            Action = $action
            Risk = $riskClass
            Passed = $passed
            Error = $null
        }
    }
    catch {
        return @{
            URL = $url
            Category = $category
            Description = $description
            Expected = $expected
            Score = $null
            Action = $null
            Risk = $null
            Passed = $false
            Error = $_.Exception.Message
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SafeExtension Security URL Test Suite" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. HOMOGRAPH / PUNYCODE ATTACKS
Write-Host "[1] Testing Homograph / Punycode Attacks..." -ForegroundColor Cyan
$punyTests = @(
    @{ URL = "https://xn--pple-43d.com"; Desc = "Punycode Apple spoof" }
    @{ URL = "https://xn--googl-fsa.com"; Desc = "Punycode Google spoof" }
    @{ URL = "https://gοοgle.com"; Desc = "Greek omicron in Google" }
)
foreach ($test in $punyTests) {
    $result = Test-URL -url $test.URL -category "Homograph" -expected "block" -description $test.Desc
    $results += $result
}

# 2. BRAND SPOOFING + SUBDOMAIN TRICKS
Write-Host "[2] Testing Brand Spoofing + Subdomain Tricks..." -ForegroundColor Cyan
$brandTests = @(
    @{ URL = "https://paypal.secure-login.com"; Desc = "PayPal subdomain trick" }
    @{ URL = "https://google.account.verify-login.net"; Desc = "Google subdomain trick" }
    @{ URL = "https://amazon.login.security-check.co"; Desc = "Amazon subdomain trick" }
    @{ URL = "https://facebook.verify-user-access.com"; Desc = "Facebook subdomain trick" }
)
foreach ($test in $brandTests) {
    $result = Test-URL -url $test.URL -category "Brand Spoofing" -expected "block" -description $test.Desc
    $results += $result
}

# 3. CHARACTER SUBSTITUTION ATTACKS
Write-Host "[3] Testing Character Substitution Attacks..." -ForegroundColor Cyan
$charTests = @(
    @{ URL = "https://paypa1.com"; Desc = "PayPal with 1 instead of l" }
    @{ URL = "https://g00gle.com"; Desc = "Google with 0s instead of o" }
    @{ URL = "https://micr0soft-login.com"; Desc = "Microsoft with 0 instead of O" }
    @{ URL = "https://faceb00k-security.net"; Desc = "Facebook with 00 instead of oo" }
)
foreach ($test in $charTests) {
    $result = Test-URL -url $test.URL -category "Character Substitution" -expected "block" -description $test.Desc
    $results += $result
}

# 4. URL SHORTENERS
Write-Host "[4] Testing URL Shorteners..." -ForegroundColor Cyan
$shortenerTests = @(
    @{ URL = "https://bit.ly/3example"; Desc = "Bit.ly shortener" }
    @{ URL = "https://tinyurl.com/example123"; Desc = "TinyURL shortener" }
    @{ URL = "https://t.co/example"; Desc = "Twitter shortener" }
)
foreach ($test in $shortenerTests) {
    $result = Test-URL -url $test.URL -category "URL Shortener" -expected "warn" -description $test.Desc
    $results += $result
}

# 5. LONG & OBFUSCATED URLs
Write-Host "[5] Testing Long & Obfuscated URLs..." -ForegroundColor Cyan
$longTests = @(
    @{ URL = "https://secure-login-account-verification-update-user-info-paypal.com/login/verify/session/update/index.php?id=123456789"; Desc = "Extremely long obfuscated URL" }
)
foreach ($test in $longTests) {
    $result = Test-URL -url $test.URL -category "Long URL" -expected "warn" -description $test.Desc
    $results += $result
}

# 6. IP-BASED URLs
Write-Host "[6] Testing IP-Based URLs..." -ForegroundColor Cyan
$ipTests = @(
    @{ URL = "http://192.168.1.1/login"; Desc = "Private IPv4" }
    @{ URL = "http://185.199.110.153/secure-login"; Desc = "Public IPv4" }
)
foreach ($test in $ipTests) {
    $result = Test-URL -url $test.URL -category "IP URL" -expected "warn" -description $test.Desc
    $results += $result
}

# 7. JAVASCRIPT / DATA URLS
Write-Host "[7] Testing JavaScript / Data URLs..." -ForegroundColor Cyan
$jsTests = @(
    @{ URL = "javascript:alert(document.cookie)"; Desc = "JavaScript URL" }
    @{ URL = "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="; Desc = "Data URL" }
)
foreach ($test in $jsTests) {
    $result = Test-URL -url $test.URL -category "Code Execution" -expected "block" -description $test.Desc
    $results += $result
}

# 8. SUSPICIOUS TLDS
Write-Host "[8] Testing Suspicious TLDs..." -ForegroundColor Cyan
$tldTests = @(
    @{ URL = "https://secure-login.xyz"; Desc = "Suspicious XYZ TLD" }
    @{ URL = "https://paypal-update.top"; Desc = "Suspicious TOP TLD" }
    @{ URL = "https://account-verification.click"; Desc = "Suspicious CLICK TLD" }
    @{ URL = "https://bank-login.gq"; Desc = "Suspicious GQ TLD" }
)
foreach ($test in $tldTests) {
    $result = Test-URL -url $test.URL -category "Suspicious TLD" -expected "block" -description $test.Desc
    $results += $result
}

# 9. DEEP SUBDOMAIN CHAINS
Write-Host "[9] Testing Deep Subdomain Chains..." -ForegroundColor Cyan
$deepTests = @(
    @{ URL = "https://login.secure.verify.account.google.com.malicious.site"; Desc = "Deep subdomain chain with Google" }
    @{ URL = "https://a.b.c.d.e.f.g.paypal.com.fake-domain.xyz"; Desc = "Deep subdomain chain with PayPal" }
)
foreach ($test in $deepTests) {
    $result = Test-URL -url $test.URL -category "Deep Subdomain" -expected "block" -description $test.Desc
    $results += $result
}

# 10. LEGITIMATE SITES (FALSE POSITIVE TEST)
Write-Host "[10] Testing Legitimate Sites (False Positive Check)..." -ForegroundColor Cyan
$legTests = @(
    @{ URL = "https://www.google.com"; Desc = "Google" }
    @{ URL = "https://github.com"; Desc = "GitHub" }
    @{ URL = "https://amazon.in"; Desc = "Amazon India" }
    @{ URL = "https://stackoverflow.com"; Desc = "Stack Overflow" }
)
foreach ($test in $legTests) {
    $result = Test-URL -url $test.URL -category "Legitimate" -expected "allow" -description $test.Desc
    $results += $result
}

# 11. CUSTOM CRAFTED ATTACK
Write-Host "[11] Testing Custom Crafted Attacks..." -ForegroundColor Cyan
$customTests = @(
    @{ URL = "https://paypa1-secure-login-verification-account-update.com"; Desc = "Combined: brand spoof + keyword stuffing + substitution" }
)
foreach ($test in $customTests) {
    $result = Test-URL -url $test.URL -category "Custom Attack" -expected "block" -description $test.Desc
    $results += $result
}

# Generate Report
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SECURITY TEST RESULTS REPORT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$passCount = ($results | Where-Object { $_.Passed -eq $true }).Count
$failCount = ($results | Where-Object { $_.Passed -eq $false }).Count
$totalCount = $results.Count

Write-Host "Test Summary:" -ForegroundColor Cyan
Write-Host ("Total Tests: {0}" -f $totalCount)
Write-Host ("Passed: {0}" -f $passCount) -ForegroundColor Green
Write-Host ("Failed: {0}" -f $failCount) -ForegroundColor Red
Write-Host ("Success Rate: {0:P}" -f ($passCount / $totalCount)) -ForegroundColor Yellow

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DETAILED RESULTS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$results | Group-Object -Property Category | ForEach-Object {
    Write-Host ("--- {0} ---" -f $_.Name) -ForegroundColor Blue
    foreach ($result in $_.Group) {
        $statusColor = if ($result.Passed) { "Green" } else { "Red" }
        $status = if ($result.Passed) { "✓ PASS" } else { "✗ FAIL" }
        
        Write-Host ($status) -ForegroundColor $statusColor -NoNewline
        Write-Host (" | {0}" -f $result.Description)
        Write-Host ("  URL: {0}" -f $result.URL)
        Write-Host ("  Expected: {0}, Got: Score={1}, Action={2}, Risk={3}" -f $result.Expected, $result.Score, $result.Action, $result.Risk)
        
        if ($result.Error) {
            Write-Host ("  ERROR: {0}" -f $result.Error) -ForegroundColor Red
        }
        Write-Host ""
    }
}

# Export to CSV
$csvPath = "c:\Users\Fahad\OneDrive\Desktop\safeextension\safeextension\test_results.csv"
$results | Export-Csv -Path $csvPath -NoTypeInformation
Write-Host ("`nResults exported to: {0}" -f $csvPath) -ForegroundColor Green

# Final verdict
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SECURITY ASSESSMENT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if ($failCount -eq 0) {
    Write-Host "✓ ALL TESTS PASSED! System is ready for production." -ForegroundColor Green
} elseif ($passCount / $totalCount -ge 0.9) {
    Write-Host "✓ 90%+ tests passed. Minor improvements needed." -ForegroundColor Yellow
} else {
    Write-Host "✗ Critical failures detected. System needs major improvements." -ForegroundColor Red
}

Write-Host "`n========================================`n" -ForegroundColor Cyan
