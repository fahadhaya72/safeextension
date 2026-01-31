# SafeExtension - Project Structure & File Reference

## Complete Project Structure

```
safeextension/
│
├── 📁 backend/
│   ├── 📁 src/
│   │   ├── 📄 index.js                    # Main Express application & API endpoints
│   │   ├── 📄 cache.js                    # LRU cache for response caching
│   │   ├── 📄 logger.js                   # Pino logging configuration
│   │   ├── 📄 scoring.js                  # Risk scoring algorithm
│   │   ├── 📄 scoring.test.js             # Unit tests for scoring logic
│   │   ├── 📄 api.test.js                 # Integration tests for API
│   │   └── 📁 services/
│   │       ├── 📄 safebrowsing.js        # Google Safe Browsing API integration
│   │       └── 📄 whois.js               # WHOIS domain age lookup
│   │
│   ├── 📄 package.json                   # NPM dependencies and scripts
│   ├── 📄 .env.example                   # Environment variables template
│   ├── 📄 .gitignore                     # Git ignore rules
│   ├── 📄 Dockerfile                     # Docker container configuration
│   └── 📁 node_modules/                  # Installed dependencies (git ignored)
│
├── 📁 extension/
│   ├── 📄 manifest.json                 # Chrome extension manifest
│   ├── 📄 popup.html                    # Popup UI HTML
│   ├── 📄 popup.js                      # Popup logic and interaction
│   ├── 📄 popup.css                     # Popup styling
│   ├── 📄 background.js                 # Service worker for extension
│   ├── 📄 content.js                    # Content script for page injection
│   └── 📁 icons/
│       ├── 📄 icon-16.png               # 16x16 icon
│       ├── 📄 icon-48.png               # 48x48 icon
│       └── 📄 icon-128.png              # 128x128 icon
│
├── 📄 docker-compose.yml                # Docker Compose orchestration
├── 📄 .env.example                      # Root environment template
├── 📄 .gitignore                        # Root git ignore
├── 📄 README.md                         # Main project documentation
├── 📄 QUICK_START.md                    # 5-minute setup guide
├── 📄 API_SPECIFICATION.md              # Complete API reference
└── 📄 PROJECT_STRUCTURE.md              # This file
```

---

## 📖 File Descriptions

### Backend Files

#### `backend/src/index.js`
**Purpose:** Main Express application server  
**Responsibilities:**
- Express app initialization
- Middleware setup (helmet, cors, rate limiting, morgan)
- API endpoint definitions
- Redirect checking logic
- Error handling and global error listeners

**Key Exports:** None (runs server directly)

**Key Functions:**
- `checkRedirects(url)` - Follows redirect chain, max 10 hops
- `responseFromFactors(url, factors, extra)` - Builds API response
- Error handlers for unhandled rejections

**Environment Variables Used:**
- `PORT` - Server port (default: 4000)
- `ALLOWED_ORIGIN` - CORS origin (default: *)
- All others passed to dependencies

---

#### `backend/src/cache.js`
**Purpose:** Response caching using LRU (Least Recently Used) cache  
**Responsibilities:**
- Exports singleton cache instance
- Configurable TTL (time-to-live)

**Key Exports:**
- `cache` - LRU cache instance

**Configuration:**
- `max: 500` - Maximum number of items to cache
- `ttl` - Time-to-live in milliseconds (from env `CACHE_TTL_SECONDS`)

**Usage Example:**
```javascript
cache.set('check:https://google.com', resultData);
const cached = cache.get('check:https://google.com');
```

---

#### `backend/src/logger.js`
**Purpose:** Structured logging using Pino  
**Responsibilities:**
- Configure logger with appropriate level
- Provide consistent logging interface

**Key Exports:**
- `default` - Pino logger instance

**Log Levels:**
- `debug` - Detailed debugging information
- `info` - General information
- `warn` - Warning messages
- `error` - Error messages

**Usage Example:**
```javascript
logger.info({ url, score }, 'decision');
logger.error({ err }, 'Check failed');
```

---

#### `backend/src/scoring.js`
**Purpose:** Core risk scoring and classification logic  
**Responsibilities:**
- URL validation
- URL syntax analysis
- Risk score computation
- Risk classification
- Suspicious keyword detection

**Key Exports:**
- `isValidUrl(url)` - Validates URL format
- `analyzeUrlSyntax(url)` - Extracts protocol, hostname, path
- `computeScore(factors)` - Calculates risk score and classification
- `classify(score)` - Determines action (allow/warn/block)
- `hasSuspiciousKeywords(url)` - Checks for phishing keywords

**Risk Scoring:**
- Base: 100 points
- Deductions applied based on factors
- Result clamped to 0-100

**Suspicious Keywords:**
login, verify, update, secure, bank, account, paypal, free, bonus, win, prize

---

#### `backend/src/services/safebrowsing.js`
**Purpose:** Google Safe Browsing API integration  
**Responsibilities:**
- Check URLs against Google's threat database
- Handle API errors gracefully
- Format threat information

**Key Exports:**
- `checkSafeBrowsing(url)` - Async function to check URL

**Return Format:**
```javascript
{
  listed: boolean,           // Is URL in threat database?
  source: 'google_safebrowsing',
  details: Array,            // Threat details if listed
  note: 'api_key_missing' | 'api_error' | 'timeout' | 'exception'
}
```

**Threat Types Checked:**
- MALWARE
- SOCIAL_ENGINEERING
- UNWANTED_SOFTWARE
- POTENTIALLY_HARMFUL_APPLICATION

---

#### `backend/src/services/whois.js`
**Purpose:** Domain age detection via WHOIS  
**Responsibilities:**
- Lookup domain creation date
- Calculate domain age in days
- Try multiple WHOIS sources

**Key Exports:**
- `getDomainAgeDays(url)` - Returns domain age or null

**Data Sources (in order):**
1. API Ninjas WHOIS API (faster, paid)
2. whois-json package (free, slower)

**Return:** Number of days since domain creation, or null if unable to determine

---

#### `backend/src/scoring.test.js`
**Purpose:** Unit tests for scoring logic  
**Test Coverage:**
- URL validation
- URL syntax analysis
- Keyword detection
- Score computation
- Risk classification
- Action determination

**Run Tests:**
```bash
npm test
```

---

#### `backend/src/api.test.js`
**Purpose:** Integration tests for API endpoints  
**Test Coverage:**
- Health endpoint
- Input validation
- Error responses

---

### Extension Files

#### `extension/manifest.json`
**Purpose:** Extension configuration file  
**Contains:**
- Extension metadata (name, version, description)
- Permissions required
- Content scripts
- Background service worker
- Action (popup) configuration
- Icons

**Key Permissions:**
- `activeTab`, `tabs` - Access current tab info
- `scripting` - Execute scripts on pages
- `<all_urls>` - Access all websites

---

#### `extension/popup.html`
**Purpose:** Extension popup UI  
**Features:**
- URL input field
- Check button
- Results display
- Risk score visualization
- Risk factors list
- Technical details
- Copy result button

**Structure:**
- Header with extension title
- Input section
- Loader animation
- Result display (hidden by default)
- Error message area
- Footer with settings

---

#### `extension/popup.css`
**Purpose:** Popup styling  
**Design Elements:**
- Gradient background (purple theme)
- Score circle visualization
- Color coding: green (safe), orange (warn), red (danger)
- Responsive layout
- Animations and transitions
- Custom scrollbars

**Key Classes:**
- `.score-circle` - Risk score display
- `.risk-factors` - List of detected factors
- `.safe/.warning/.danger` - Risk level indicators

---

#### `extension/popup.js`
**Purpose:** Popup logic and user interaction  
**Responsibilities:**
- Handle user input
- Call backend API
- Display results
- Manage caching
- Handle errors
- Update UI based on results

**Key Class:** `URLChecker`

**Methods:**
- `checkURL()` - Main check function
- `displayResult(data)` - Render results
- `showError(message)` - Show error state
- `copyResult()` - Copy to clipboard

**API Integration:**
```javascript
const API_BASE_URL = 'http://localhost:4000/api';
```

---

#### `extension/background.js`
**Purpose:** Service worker for extension  
**Responsibilities:**
- Handle messages from content scripts
- Communicate with API
- Manage extension lifecycle

**Event Listeners:**
- `chrome.runtime.onMessage` - Handle messages
- `chrome.runtime.onInstalled` - Handle installation

---

#### `extension/content.js`
**Purpose:** Content script injected into web pages  
**Responsibilities:**
- Scan page for links
- Monitor for new links
- Highlight URLs based on safety
- Provide link information on hover

**Features:**
- DOM mutation observer
- Link highlighting (green/orange/red borders)
- Hover analysis
- CSS injection for visual indicators

---

#### `extension/icons/icon-*.png`
**Purpose:** Extension icons in different sizes  
**Sizes:**
- `icon-16.png` - Toolbar icon
- `icon-48.png` - Extension list icon
- `icon-128.png` - Chrome Web Store icon

---

### Configuration Files

#### `package.json`
**Purpose:** Node.js project manifest  
**Contains:**
- Project metadata
- Dependencies (production)
- Dev dependencies
- Scripts (start, dev, test)
- Engine requirements

**Key Scripts:**
- `npm start` - Run production server
- `npm run dev` - Run development with auto-reload
- `npm test` - Run test suite

---

#### `.env.example` & `backend/.env.example`
**Purpose:** Environment variable templates  
**Variables:**
- `PORT` - Server port
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging verbosity
- `ALLOWED_ORIGIN` - CORS configuration
- `CACHE_TTL_SECONDS` - Cache duration
- API keys (Google Safe Browsing, API Ninjas)

**Usage:**
```bash
cp .env.example .env
# Edit .env with your values
```

---

#### `Dockerfile`
**Purpose:** Docker container configuration  
**Builds:**
- Node.js 18 Alpine-based image
- Minimal, production-ready container

**Key Commands:**
- `npm install --only=production`
- Health check on `/api/health`
- Exposes port 4000

---

#### `docker-compose.yml`
**Purpose:** Multi-container orchestration  
**Services:**
- `safeextension-backend` - Main API server
- Network: `safeextension-network`
- Health checks
- Environment variables
- Volume mounts for development

---

### Documentation Files

#### `README.md`
**Purpose:** Complete project documentation  
**Sections:**
- Features overview
- Installation instructions
- Configuration guide
- Running instructions
- API documentation
- Risk factors explanation
- Testing guide
- Troubleshooting
- Contributing guidelines

---

#### `QUICK_START.md`
**Purpose:** Quick setup guide  
**Content:**
- 5-minute setup steps
- API key acquisition
- Quick testing
- Troubleshooting tips

---

#### `API_SPECIFICATION.md`
**Purpose:** Complete API reference  
**Content:**
- Endpoint definitions
- Request/response formats
- Error codes
- Scoring algorithm
- Best practices
- Examples

---

#### `PROJECT_STRUCTURE.md`
**Purpose:** This file  
**Content:**
- Complete file listing
- File descriptions
- Key functions and exports
- Dependencies and relationships

---

## 🔄 Data Flow

### URL Check Flow

```
User Input (popup.js)
    ↓
API Call: POST /api/check-url
    ↓
Backend: index.js (checkURL endpoint)
    ↓
Check Cache → Return if found
    ↓
Parallel Execution:
  ├→ scoring.js: analyzeUrlSyntax()
  ├→ scoring.js: hasSuspiciousKeywords()
  ├→ safebrowsing.js: checkSafeBrowsing()
  ├→ whois.js: getDomainAgeDays()
  └→ index.js: checkRedirects()
    ↓
scoring.js: computeScore(factors)
    ↓
Cache Result
    ↓
Response to Frontend
    ↓
popup.js: displayResult()
    ↓
User Sees Results
```

---

## 🔗 Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.18.2 | Web framework |
| helmet | ^7.1.0 | Security headers |
| cors | ^2.8.5 | CORS middleware |
| express-rate-limit | ^7.0.0 | Rate limiting |
| morgan | ^1.10.0 | HTTP logging |
| pino | ^8.16.2 | Structured logging |
| node-fetch | ^3.3.2 | HTTP client |
| lru-cache | ^10.1.0 | Response caching |
| whois-json | ^2.0.0 | WHOIS lookups |
| tldts | ^13.1.0 | Domain parsing |
| dotenv | ^16.3.1 | Environment variables |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| nodemon | ^3.0.2 | Auto-reload server |
| eslint | ^8.53.0 | Code linting |

---

## 🧪 Testing Files

### Test Execution

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

### Test Files

- `backend/src/scoring.test.js` - Scoring logic tests
- `backend/src/api.test.js` - API endpoint tests

---

## 🚀 Deployment Map

### Local Development
1. Backend: `npm run dev` (port 4000)
2. Extension: Load unpacked from `chrome://extensions/`

### Docker Deployment
1. Build: `docker-compose build`
2. Run: `docker-compose up -d`
3. Access: `http://localhost:4000`

### Production Deployment
1. Update `.env` with production values
2. Set `NODE_ENV=production`
3. Use `npm start` (no auto-reload)
4. Configure reverse proxy (nginx/Apache)
5. Use HTTPS
6. Configure proper CORS origins

---

## 📊 Project Statistics

| Metric | Value |
|--------|-------|
| Backend Files | 8 |
| Extension Files | 6 |
| Configuration Files | 6 |
| Documentation Files | 5 |
| Test Files | 2 |
| Total Files | 27+ |
| Lines of Code | ~2000+ |
| Production Dependencies | 11 |
| Development Dependencies | 2 |

---

## 🔐 Security Considerations

### Input Validation
- URL length checked (max 2048 chars)
- URL format validated
- Parameters type-checked

### Error Handling
- No sensitive data in error messages
- All exceptions logged securely
- Graceful degradation

### API Security
- Rate limiting: 60 req/min per IP
- CORS protection
- Helmet security headers
- Input sanitization

### Data Protection
- No sensitive data cached
- Cache TTL configurable
- No credentials stored in code

---

## 🎯 Quick Reference

### Start Server
```bash
cd backend && npm run dev
```

### Load Extension
1. Go to `chrome://extensions/`
2. Enable Developer mode
3. Load unpacked → select `extension/` folder

### Run Tests
```bash
cd backend && npm test
```

### Deploy with Docker
```bash
docker-compose up -d
```

### Check Health
```bash
curl http://localhost:4000/api/health
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0  
**Status:** Complete & Production-Ready ✅
