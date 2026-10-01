# SafeExtension

SafeExtension is a Chrome extension and Node.js backend that check website URLs for common phishing and security warning signs. It gives the user a score, an explanation, and a recommendation before or during browsing.

> SafeExtension is a rule-based safety aid, not antivirus software. A high score is not proof that a site is safe, and a low score can be a false positive.

## Why this project exists

Phishing pages often imitate real companies, hide behind look-alike domains, or use misleading links. SafeExtension aims to make those risks easier to notice by checking a URL and showing a simple result instead of asking the user to inspect technical signals themselves.

It does not inspect or sandbox the website's page content. Its decision is based mainly on the URL, local rules, and optional threat-intelligence checks.

## How it works

1. The Chrome extension checks the active website after navigation, or the user enters a URL in the popup.
2. The popup or content script sends the URL to the extension's background service worker.
3. The service worker validates the URL and checks its local result cache. Results are kept for up to 24 hours, with a maximum of 500 URLs.
4. If there is no saved result, the worker sends the URL to the backend at `POST /api/extension-check`.
5. The backend validates the URL, checks its short-lived in-memory cache, and runs the scoring engine.
6. The extension shows the score and status. Depending on settings and score, it can display a warning or block a visit.

If the backend cannot be reached, the extension uses its small built-in offline domain list. In that fallback, an unlisted URL receives a score of **75**. This is only an offline fallback result; it is not the backend's score and does not mean the URL has been proven safe.

## How scoring works

The score is a **safety score**: `100` means the checks found little or no risk, while `0` means severe risk was detected. It is a heuristic score, not a probability or guarantee.

The backend evaluates URLs in this order:

1. **Trusted-domain check.** A domain on the backend's trusted list, or one of its subdomains, is immediately allowed with score `100`. The list is maintained in code and can be incomplete or out of date.
2. **Known adult-content check.** Listed domains or matching URL keywords are immediately blocked with score `0`.
3. **Strict rules.** Rules look for signs such as brand names in suspicious subdomains, look-alike brand spelling, punycode or mixed-script hostnames, suspicious top-level domains, IP-based URLs, URL shorteners, and unusually deep subdomains. A blocking rule returns a low score immediately; it does not continue to the weighted calculation.
4. **Weighted checks.** If no blocking rule fires, the backend starts at `100` and subtracts risk points for detected signals. Current factors include non-HTTPS, brand spoofing, deep subdomains, long URLs, phishing-related hostname words, high-entropy domain names, character substitutions, URL shorteners, temporary tunnel services, IP-based hosts, and threat-feed matches. The score is clamped between `0` and `100`.

The main weighted deductions are capped per factor: non-HTTPS `10`, brand spoofing `20`, deep subdomains `8`, long URL `5`, phishing words `12`, high entropy `15`, character substitutions `8`, URL shortener `12`, tunnel service `25`, IP-based host `10`, and a threat-feed match `40`.

The active extension-check scoring path can query **Google Safe Browsing** and **PhishTank**. Configure their API keys in `backend/.env` to enable those checks. If a key is missing or a provider request fails, that provider does not contribute a threat match. Other feed integrations are present in the repository but are not called by this endpoint's current scoring path.

### Score labels and actions

The popup displays these score bands:

| Score | Popup status |
| --- | --- |
| 90-100 | Allow |
| 50-89 | Alert |
| 40-49 | High Alert |
| 0-39 | Block |

The backend's API `action` is a separate field: weighted scores below `40` are `block`, scores `40-79` are `warn`, and scores `80-100` are `allow`. Strict rules and trusted-domain matches can override the weighted path. When automatic blocking is enabled, the extension blocks navigation for scores below `40`.

The displayed confidence value is also heuristic. It has not been calibrated as a statistical probability.

## Run the backend locally

Requirements: Node.js 16 or later and npm.

In PowerShell:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env` and set the configuration you need:

- `PORT=4000` for the local API port.
- `SAFE_BROWSING_API_KEY` and `PHISHTANK_API_KEY` for the optional threat checks.
- `CHROME_EXTENSION_ID` to the ID shown for your unpacked extension at `chrome://extensions`.
- `ALLOWED_ORIGIN` to your local web origin if using the landing page. The configured extension ID is separately allowed by the backend CORS policy.

Start the API:

```powershell
npm start
```

For automatic restarts during development:

```powershell
npm run dev
```

The API health endpoint is `http://localhost:4000/api/health`.

## Load the Chrome extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose this repository's `extension` folder.
4. Copy the extension ID from the extension details into the backend's `CHROME_EXTENSION_ID` setting.

The extension currently points to the hosted backend URL in `extension/background.js`. To use a local backend, change `CONFIG.API_BASE_URL` there to `http://localhost:4000/api`, save, then reload the extension from `chrome://extensions`.

## Run backend tests

From the repository root:

```powershell
npm test --prefix backend
```

The tests cover the backend's extension-origin CORS policy and selected URL-rule cases.

## Project layout

```text
backend/       Express API, URL scoring, CORS, and threat-check services
extension/     Chrome Manifest V3 popup, service worker, and content scripts
landing/       Optional project landing page
```

Useful files:

- `extension/manifest.json` - Chrome extension permissions and entry points.
- `extension/popup.html`, `popup.css`, `popup.js` - Popup UI and interactions.
- `extension/background.js` - URL checks, backend requests, caching, and navigation handling.
- `extension/content.js` - Page link highlighting and warning/status display.
- `backend/src/index.js` - Express API and `/api/extension-check` endpoint.
- `backend/src/scoring-refactored.js` - Active scoring pipeline for the extension endpoint.
- `backend/src/rule-engine.js` - Immediate URL warning/block rules.

## Privacy and limitations

URLs checked by the extension are sent to the configured backend. If threat checks are enabled, the backend may also send the URL to the configured external providers. Avoid checking URLs containing private access tokens or other secrets.

The system can miss new threats and can flag legitimate sites when rules are too broad or trusted-domain data is incomplete. It does not verify the reputation of every site on the internet, inspect downloaded files, or guarantee that a site is safe. Keep Chrome's built-in protections enabled and use your own judgment when a warning appears.
