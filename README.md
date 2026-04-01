# SafeExtension - Browser Extension for URL Safety Analysis

A comprehensive browser extension that analyzes URLs for phishing, malware, and other security risks in real-time.

Live Demo :
```
https://safeextension.vercel.app/
```
## 📋 Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Backend Setup](#backend-setup)
  - [Extension Setup](#extension-setup)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
  - [Development Mode](#development-mode)
  - [Production Mode](#production-mode)
  - [Docker Deployment](#docker-deployment)
- [API Documentation](#api-documentation)
- [How It Works](#how-it-works)
- [Risk Factors](#risk-factors)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ Features

- 🔍 **Real-time URL Analysis** - Instantly check URLs for security risks
- 🛡️ **Multi-factor Risk Assessment** - Analyzes 5 different risk factors
- 🌐 **Google Safe Browsing Integration** - Real-time threat database lookups
- 📅 **Domain Age Analysis** - Detects recently registered suspicious domains
- 🔗 **Redirect Detection** - Identifies excessive or suspicious redirects
- 🔐 **HTTPS Verification** - Warns about unencrypted connections
- 💾 **Smart Caching** - Reduces API calls with intelligent result caching
- 📊 **Detailed Risk Reporting** - Clear, actionable safety recommendations
- 🎨 **Beautiful UI** - Modern, intuitive popup interface
- ⚡ **Performance Optimized** - Fast, responsive experience

---

## 📁 Project Structure

```
safeextension/
├── backend/                          # Node.js/Express API server
│   ├── src/
│   │   ├── index.js                 # Main Express app & API endpoints
│   │   ├── cache.js                 # LRU cache implementation
│   │   ├── logger.js                # Pino logging setup
│   │   ├── scoring.js               # Risk scoring algorithm
│   │   └── services/
│   │       ├── safebrowsing.js     # Google Safe Browsing API
│   │       └── whois.js             # WHOIS domain age lookup
│   ├── package.json                 # NPM dependencies
│   ├── .env.example                 # Environment variables template
│   ├── .gitignore                   # Git ignore rules
│   └── Dockerfile                   # Docker container configuration
├── extension/                        # Browser extension files
│   ├── manifest.json               # Extension configuration
│   ├── popup.html                  # Popup interface
│   ├── popup.js                    # Popup logic
│   ├── popup.css                   # Popup styling
│   ├── background.js               # Service worker
│   ├── content.js                  # Content script for page interaction
│   └── icons/                      # Extension icons
├── docker-compose.yml              # Docker Compose configuration
└── README.md                        # This file
```

---

## 📋 Prerequisites

### Backend Requirements
- **Node.js** 16.0.0 or higher
- **npm** 7.0.0 or higher
- Internet connection for API calls

### Browser Requirements
- **Chrome/Edge** 90+ or **Firefox** 88+ (with compatibility)
- For development: Chrome/Chromium with Developer Mode enabled

### API Keys Required
1. **Google Safe Browsing API Key**
   - Get it from: https://console.cloud.google.com/
   - Enable the "Safe Browsing API"

2. **API Ninjas WHOIS API Key** (Optional but recommended)
   - Get it from: https://api-ninjas.com/api/whois
   - Provides more accurate domain age detection

---

## 🚀 Installation

### Backend Setup

1. **Clone/Extract the repository:**
   ```bash
   cd safeextension
   ```

2. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Create environment configuration:**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables** (Edit `.env`):
   ```env
   PORT=4000
   NODE_ENV=development
   ALLOWED_ORIGIN=http://localhost:3000
   SAFE_BROWSING_API_KEY=your_api_key_here
   WHOIS_NINJA_API_KEY=your_api_key_here
   ```

### Extension Setup

1. **Open Chrome/Edge Extensions Page:**
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. **Enable Developer Mode:**
   - Toggle "Developer mode" in top right

3. **Load the extension:**
   - Click "Load unpacked"
   - Navigate to `safeextension/extension/` folder
   - Select and confirm

---

## ⚙️ Configuration

### Environment Variables

Create `.env` file in the `backend/` directory:

```env
# Server Configuration
PORT=4000                              # Server port
NODE_ENV=development                   # development or production
LOG_LEVEL=info                         # Logging level: debug, info, warn, error

# CORS Configuration
ALLOWED_ORIGIN=http://localhost:3000  # Allowed origin for CORS

# Cache Configuration
CACHE_TTL_SECONDS=900                 # Cache TTL in seconds (15 minutes default)

# API Keys
SAFE_BROWSING_API_KEY=                # Google Safe Browsing API key (required)
WHOIS_NINJA_API_KEY=                  # API Ninjas WHOIS API key (optional)
```

---

## 🏃 Running the Project

### Development Mode

**Terminal 1 - Start Backend:**
```bash
cd backend
npm run dev
```

The backend will start on `http://localhost:4000` with auto-reload enabled (nodemon).

**Terminal 2 - Load Extension:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

### Production Mode

**Build and start backend:**
```bash
cd backend
npm install --only=production
npm start
```

**Load extension as above** (packaged version in production)

### Docker Deployment

**Using Docker Compose:**

1. **Create `.env` file** in root directory:
   ```bash
   cp backend/.env.example .env
   ```

2. **Configure API keys** in `.env`:
   ```env
   SAFE_BROWSING_API_KEY=your_key_here
   WHOIS_NINJA_API_KEY=your_key_here
   ```

3. **Build and run:**
   ```bash
   docker-compose up -d
   ```

4. **Check status:**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

5. **Stop containers:**
   ```bash
   docker-compose down
   ```

**Building standalone Docker image:**

```bash
docker build -t safeextension:latest -f backend/Dockerfile .
docker run -p 4000:4000 \
  -e SAFE_BROWSING_API_KEY=your_key \
  -e WHOIS_NINJA_API_KEY=your_key \
  safeextension:latest
```

---

## 📡 API Documentation

### Base URL
```
http://localhost:4000/api
```

### Endpoints

#### 1. Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "ok": true
}
```

---

#### 2. Check URL Safety
```http
POST /api/check-url
Content-Type: application/json

{
  "url": "https://example.com"
}
```

**Response (200 OK):**
```json
{
  "url": "https://example.com",
  "score": 95,
  "action": "allow",
  "risk_classification": "low",
  "risk_factors": [
    {
      "code": "NO_HTTPS",
      "points": 0
    }
  ],
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

**Response (400 Bad Request):**
```json
{
  "error": "invalid_url",
  "message": "Invalid URL format"
}
```

---

#### 3. Get Risk Details
```http
POST /api/risk-details
Content-Type: application/json

{
  "url": "https://example.com"
}
```

**Response:** (Same as `/api/check-url`)

---

## 🔍 How It Works

### Risk Scoring Algorithm

SafeExtension uses a **risk-based scoring system** (0-100 scale):

1. **Base Score**: 100 (Safe)
2. **Multiple Risk Factors Analyzed**:
   - HTTPS encryption verification
   - Domain registration age analysis
   - Threat intelligence database checks
   - Suspicious pattern detection
   - Redirect chain analysis
   - IP obfuscation detection
   - Temporary service identification
   - Subdomain pattern analysis

3. **Final Score**: 100 - total deductions (clamped to 0-100)

### Risk Classification

- **Allow** (Score: 90-100): ✅ Safe - No major threats
- **Alert** (Score: 50-89): ⚠️ Warn - Suspicious, proceed carefully
- **High Alert** (Score: 40-49): 🚨 High Risk - Very suspicious
- **Block** (Score: 0-39): 🚫 Block - High confidence malicious

### Risk Factors

| Factor | Detection Method | Impact Level |
|--------|------------------|--------------|
| **HTTPS** | Protocol verification | High |
| **Domain Age** | WHOIS registration analysis | High |
| **Threat Feed** | Global threat databases | Critical |
| **Keywords** | Pattern matching | Medium |
| **Redirects** | Chain analysis | Medium |
| **IP Obfuscation** | Pattern detection | High |
| **Temporary Services** | Service identification | High |
| **Suspicious Subdomains** | Pattern analysis | Medium |

### Suspicious Pattern Detection

The system detects various suspicious patterns including:
- Authentication-related terms
- Financial/banking terminology
- Urgency/offer language
- Technical manipulation attempts
- Service abuse patterns

*Note: Specific keywords and thresholds are not disclosed to prevent detection bypass attempts.*

---

## 🧪 Testing

### Manual Testing

1. **Test Safe URL:**
   ```
   https://www.google.com
   Expected: Score 95+, Allow
   ```

2. **Test Suspicious URL:**
   ```
   https://secure-login-verify.example.com
   Expected: Score <70, Warn/Block
   ```

3. **Test Invalid URL:**
   ```
   not-a-url
   Expected: 400 error
   ```

### Unit Tests

```bash
cd backend
npm test
```

---

## 🐛 Troubleshooting

### Issue: Backend won't start

**Solution:**
```bash
# Check Node version
node --version  # Should be 16+

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check if port 4000 is in use
lsof -i :4000  # macOS/Linux
netstat -ano | findstr :4000  # Windows
```

### Issue: Extension shows "Cannot reach backend"

**Solution:**
1. Ensure backend is running: `http://localhost:4000/api/health`
2. Check `popup.js` - API_BASE_URL should be `http://localhost:4000/api`
3. Disable CORS issues for development (using ALLOWED_ORIGIN=*)
4. Check browser console for CORS errors

### Issue: API keys not working

**Solution:**
1. Verify API keys are correct in `.env`
2. Check if APIs are enabled in respective dashboards
3. Ensure rate limits aren't exceeded
4. Check logs: `npm run dev` shows API errors

### Issue: Cache causing stale results

**Solution:**
1. Clear extension storage: Settings > Clear browsing data
2. Reduce `CACHE_TTL_SECONDS` in `.env` (default: 900)
3. Restart backend: `npm run dev`

---

## 🔐 Security Considerations

1. **API Keys**: Never commit `.env` file with real keys
2. **CORS**: Restrict `ALLOWED_ORIGIN` in production
3. **HTTPS**: Always use HTTPS in production
4. **Rate Limiting**: Default 60 requests/minute per IP
5. **Input Validation**: All inputs sanitized and validated
6. **Error Handling**: No sensitive info in error messages

---

## 📦 Building for Production

### Backend Deployment

```bash
# Install production dependencies only
npm install --only=production

# Start with production environment
NODE_ENV=production npm start
```

### Extension Packaging

1. Remove development files
2. Update manifest version
3. Package extension (Chrome):
   ```bash
   # In Chrome: More Tools > Extensions > Pack Extension
   ```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**MIT License Summary:**

```
Copyright (c) 2026 Fahad

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 📞 Support

For issues, questions, or suggestions:
1. Check [Troubleshooting](#troubleshooting) section
2. Open an issue on GitHub
3. Check browser console for error messages

---

## 🙏 Acknowledgments

- Google Safe Browsing API for threat detection
- API Ninjas for WHOIS service
- Express.js community for excellent framework

---

**Last Updated**: January 2026  
**Version**: 1.1.3  
**Status**: Production Ready ✅
