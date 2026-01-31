# SafeExtension API Specification

## Overview

SafeExtension provides a RESTful API for analyzing URLs for security risks. The API integrates multiple threat detection services to provide comprehensive safety scoring.

**Base URL:** `http://localhost:4000/api`  
**Version:** 1.0.0  
**Content-Type:** `application/json`

---

## Authentication

Currently, the API does not require authentication. This is suitable for local/private deployments. For production, consider adding:
- API key authentication
- OAuth 2.0
- JWT tokens

---

## Rate Limiting

- **Limit:** 60 requests per minute per IP address
- **Headers:**
  - `RateLimit-Limit: 60`
  - `RateLimit-Remaining: 59`
  - `RateLimit-Reset: 1234567890`

**Response when limit exceeded:**
```json
{
  "error": "Too many requests",
  "retryAfter": 60
}
```

---

## Response Format

All responses follow a consistent structure:

### Success Response
```json
{
  "url": "string",
  "score": 0-100,
  "action": "allow|warn|block",
  "risk_classification": "low|medium|high",
  "risk_factors": [
    {
      "code": "string",
      "points": number
    }
  ],
  "details": {
    "domainAgeDays": number|null,
    "safeBrowsing": object,
    "redirects": number
  }
}
```

### Error Response
```json
{
  "error": "error_code",
  "message": "Human readable error message"
}
```

---

## Endpoints

### 1. Health Check

**Endpoint:** `GET /api/health`

**Purpose:** Check if the API is running and healthy.

**Request:**
```http
GET /api/health HTTP/1.1
Host: localhost:4000
```

**Response (200 OK):**
```json
{
  "ok": true
}
```

**Use Cases:**
- Monitor service uptime
- Load balancer health checks
- Docker container health verification

---

### 2. Check URL Safety

**Endpoint:** `POST /api/check-url`

**Purpose:** Analyze a URL for security risks and return a comprehensive safety assessment.

**Request:**
```http
POST /api/check-url HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "url": "https://example.com"
}
```

**Request Body Parameters:**

| Parameter | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| `url` | string | Yes | 1-2048 chars, valid URL format | The URL to analyze |

**Response (200 OK):**
```json
{
  "url": "https://example.com",
  "score": 95,
  "action": "allow",
  "risk_classification": "low",
  "risk_factors": [],
  "details": {
    "domainAgeDays": 3650,
    "safeBrowsing": {
      "listed": false,
      "source": "google_safebrowsing",
      "details": []
    },
    "redirects": 0
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | The analyzed URL (normalized) |
| `score` | number | Safety score 0-100 (higher = safer) |
| `action` | string | Recommended action: allow/warn/block |
| `risk_classification` | string | Risk level: low/medium/high |
| `risk_factors` | array | List of detected risk factors |
| `details` | object | Technical analysis details |

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Successfully analyzed URL |
| 400 | Invalid request (missing/invalid URL) |
| 500 | Server error during analysis |
| 429 | Rate limit exceeded |

**Error Examples:**

Missing URL:
```json
{
  "error": "url_required",
  "message": "URL parameter is required and must be a string"
}
```

Invalid URL:
```json
{
  "error": "invalid_url",
  "message": "Invalid URL format"
}
```

URL too long:
```json
{
  "error": "url_too_long",
  "message": "URL must be less than 2048 characters"
}
```

**Example Requests:**

```bash
# Using curl
curl -X POST http://localhost:4000/api/check-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://google.com"}'

# Using JavaScript/Fetch
fetch('http://localhost:4000/api/check-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://google.com' })
})
.then(r => r.json())
.then(data => console.log(data));

# Using Python/Requests
import requests
response = requests.post(
  'http://localhost:4000/api/check-url',
  json={'url': 'https://google.com'}
)
print(response.json())
```

---

### 3. Get Risk Details

**Endpoint:** `POST /api/risk-details`

**Purpose:** Get detailed risk analysis for a URL (identical to `/check-url` but with different semantic meaning).

**Request:**
```http
POST /api/risk-details HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "url": "https://example.com"
}
```

**Response (200 OK):** Same as `/api/check-url`

**Note:** This endpoint is an alias to `/check-url` for semantic clarity. Use whichever endpoint name better reflects your use case.

---

## Scoring Algorithm

### Base Score: 100 (Safe)

### Deductions:
- **No HTTPS (-20 points):** URL uses HTTP instead of HTTPS
- **Young Domain (-25 points):** Domain registered less than 180 days ago
- **Listed in Threat Feeds (-50 points):** Google Safe Browsing API flags the URL
- **Suspicious Keywords (-15 points):** URL contains phishing-related keywords
- **Excessive Redirects (-10 points):** URL has more than 3 redirects

### Final Score: 100 - total deductions (clamped to 0-100)

### Action Classification:
- **90-100:** Allow (✅ Safe)
- **50-89:** Warn (⚠️ Suspicious)
- **0-49:** Block (🚫 Dangerous)

---

## Risk Factors Reference

### NO_HTTPS
**Points:** 20  
**Trigger:** URL uses HTTP protocol instead of HTTPS  
**Recommendation:** Avoid entering sensitive information on HTTP sites

### YOUNG_DOMAIN
**Points:** 25  
**Trigger:** Domain registered less than 180 days ago  
**Recommendation:** Newer domains are sometimes used for phishing attacks

### LISTED_IN_FEEDS
**Points:** 50  
**Trigger:** URL appears in Google Safe Browsing threat database  
**Recommendation:** High confidence the site contains malware or phishing content

### SUSPICIOUS_KEYWORDS
**Points:** 15  
**Trigger:** URL contains keywords commonly used in phishing (login, verify, bank, etc.)  
**Recommendation:** Verify the domain is legitimate before entering credentials

### EXCESSIVE_REDIRECTS
**Points:** 10  
**Trigger:** URL chain has more than 3 redirects  
**Recommendation:** Excessive redirects may be used for obfuscation

---

## Suspicious Keywords List

The following keywords trigger the SUSPICIOUS_KEYWORDS flag:
- login, verify, update, secure
- bank, account, paypal
- free, bonus, win, prize

---

## Caching

Responses are cached for 15 minutes (configurable via `CACHE_TTL_SECONDS`).

**Advantages:**
- Reduced API latency
- Lower external API costs
- Offline capability (for cached results)

**Cache Key:** `check:{normalized_url}`

**Clearing Cache:**
- Restart the server
- Change `CACHE_TTL_SECONDS` environment variable
- Cache automatically expires after TTL

---

## Error Handling

All errors include both machine-readable (`error` code) and human-readable (`message`) fields.

**Common Error Codes:**

| Code | HTTP | Description |
|------|------|-------------|
| url_required | 400 | URL parameter missing |
| invalid_url | 400 | URL format invalid |
| url_too_long | 400 | URL exceeds 2048 characters |
| internal_error | 500 | Server-side error |
| api_error | 500 | External API error |
| timeout | 500 | Request timeout |

---

## Best Practices

### 1. Input Validation
Always validate URLs before sending:
```javascript
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}
```

### 2. Error Handling
```javascript
try {
  const response = await fetch('/api/check-url', {
    method: 'POST',
    body: JSON.stringify({ url })
  });
  
  if (!response.ok) {
    const error = await response.json();
    console.error(error.message);
  }
  
  const result = await response.json();
  // Handle result...
} catch (error) {
  console.error('Network error:', error);
}
```

### 3. Rate Limiting Handling
```javascript
const checkURL = async (url) => {
  try {
    const response = await fetch('/api/check-url', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      console.log(`Rate limited. Retry after ${retryAfter}s`);
      // Implement exponential backoff
    }
    
    return await response.json();
  } catch (error) {
    // Handle error
  }
};
```

### 4. Caching in Client
```javascript
const cache = new Map();

async function checkURL(url) {
  // Check local cache
  if (cache.has(url)) {
    return cache.get(url);
  }
  
  // Call API
  const result = await fetch('/api/check-url', {
    method: 'POST',
    body: JSON.stringify({ url })
  }).then(r => r.json());
  
  // Cache for 5 minutes
  cache.set(url, result);
  setTimeout(() => cache.delete(url), 5 * 60 * 1000);
  
  return result;
}
```

---

## Performance Metrics

### Typical Response Times:
- **Health Check:** < 1ms
- **Cached URL Check:** 10-50ms
- **New URL Check:** 500ms - 3s (depends on external APIs)

### Optimization Tips:
- Use caching to reduce latency
- Batch requests when possible
- Monitor rate limits to avoid 429 responses

---

## Testing

### Using curl:
```bash
# Health check
curl http://localhost:4000/api/health

# Check URL
curl -X POST http://localhost:4000/api/check-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://google.com"}'
```

### Using Postman:
1. Import collection from API docs
2. Set environment variables
3. Run requests

### Unit Tests:
```bash
cd backend
npm test
```

---

## Changelog

### v1.0.0 (January 2026)
- Initial release
- URL analysis with 5 risk factors
- Google Safe Browsing integration
- WHOIS domain age lookup
- Smart caching
- Rate limiting
- Comprehensive error handling

---

## Support

For issues or questions:
1. Check [README.md](README.md) for setup help
2. Review [QUICK_START.md](QUICK_START.md) for basic usage
3. Check server logs: `npm run dev` shows detailed output
4. Verify API keys are configured
5. Test with `http://localhost:4000/api/health`

---

**Last Updated:** January 2026  
**Status:** Production Ready ✅
