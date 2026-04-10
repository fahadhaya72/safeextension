// Background Service Worker for SafeExtension
// Handles messages and communicates between content scripts and popup

// Import offline cache
importScripts('offline-cache.js');

// Initialize offline cache
const offlineCache = new OfflineDomainCache();

// 🔐 CONFIGURATION - Replace with your actual values
const CONFIG = {
  API_BASE_URL: 'https://safeextension-backend.onrender.com/api', // Production backend URL
  EXTENSION_ID: 'your_extension_id_here' // Replace with your actual extension ID
};

// Settings cache
let settingsCache = {
  enableHighlighting: true,
  showTrustBadges: true,
  enableWarnings: true,
  autoBlock: true,
  enableTelemetry: true
};

// Load settings on startup
chrome.runtime.onStartup.addListener(() => {
  loadSettings();
});

chrome.runtime.onInstalled.addListener(() => {
  loadSettings();
});

function loadSettings() {
  try {
    chrome.storage.sync.get({
      enableHighlighting: true,
      showTrustBadges: true,
      enableWarnings: true,
      autoBlock: true,
      enableTelemetry: true
    }, (settings) => {
      settingsCache = settings;
    });
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkURL') {
    checkURL(request.url)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  } else if (request.action === 'settingsUpdated') {
    // Update cached settings
    settingsCache = request.settings;
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'getSettings') {
    sendResponse({ settings: settingsCache });
    return true;
  }
});

async function checkURL(url) {
  try {
    // First try the API
    const response = await fetch(`${CONFIG.API_BASE_URL}/extension-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded - please try again later');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('API check failed, falling back to offline cache:', error.message);
    
    // Fallback to offline cache
    try {
      const domain = new URL(url).hostname;
      const offlineResult = await offlineCache.checkDomain(domain);
      
      if (offlineResult.malicious) {
        return {
          url,
          action: 'block',
          score: 15,
          risk_level: 'high',
          reasons: [{
            code: 'OFFLINE_CACHE_BLOCK',
            points: 85,
            description: offlineResult.reason
          }],
          confidence: offlineResult.confidence,
          timestamp: new Date().toISOString(),
          source: 'offline_cache'
        };
      } else {
        return {
          url,
          action: 'allow',
          score: 75,
          risk_level: 'medium',
          reasons: [{
            code: 'OFFLINE_CACHE_ALLOW',
            points: 25,
            description: offlineResult.reason
          }],
          confidence: offlineResult.confidence,
          timestamp: new Date().toISOString(),
          source: 'offline_cache'
        };
      }
    } catch (offlineError) {
      console.error('Offline cache also failed:', offlineError);
      throw new Error('Both API and offline cache failed');
    }
  }
}

// Optional: Handle extension installation or updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('SafeExtension installed successfully');
  } else if (details.reason === 'update') {
    console.log('SafeExtension updated');
  }
});

// -- Navigation monitoring & enforcement --
// In-memory cache to avoid rechecking the same tab repeatedly
const lastChecked = new Map(); // domain -> timestamp
const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// Redirects to extension interstitial when a domain is permanently blocked
async function redirectToBlocked(tabId, originalUrl, score) {
  const blockedPage = `${chrome.runtime.getURL('blocked.html')}?url=${encodeURIComponent(originalUrl)}&score=${encodeURIComponent(score)}`;
  try {
    await chrome.tabs.update(tabId, { url: blockedPage });
  } catch (e) {
    console.error('Failed to redirect to blocked page:', e);
  }
}

// Listen for tab updates to run checks on navigation complete
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (!tab || !tab.url) return;
    // Only act on top-level http(s) navigations after load
    if (changeInfo.status !== 'complete') return;
    const url = tab.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) return;

    const domain = (new URL(url)).hostname;

    // Check storage to see if domain is permanently blocked
    const storage = await chrome.storage.sync.get(['blockedDomains']);
    const blocked = storage.blockedDomains || [];
    if (blocked.includes(domain)) {
      // Redirect to blocked interstitial
      redirectToBlocked(tabId, url, 0);
      return;
    }

    const last = lastChecked.get(domain) || 0;
    if (Date.now() - last < CHECK_INTERVAL_MS) return; // skip frequent rechecks
    lastChecked.set(domain, Date.now());

    // Run the URL check
    let result;
    try {
      result = await checkURL(url);
    } catch (err) {
      console.warn('background checkURL failed:', err.message);
      return;
    }

    const score = typeof result.score === 'number' ? result.score : 100;

    if (score < 10) {
      // Check if auto-blocking is enabled
      if (!settingsCache.autoBlock) {
        // Show warning instead of blocking
        if (settingsCache.enableWarnings) {
          try {
            await chrome.tabs.sendMessage(tabId, { action: 'showWarning', score, level: 'high_alert', url });
          } catch (e) {
            // content script may not be injected
          }
        }
        return;
      }

      // Permanently block: store in chrome.storage.sync and add to blocking rules
      const newBlocked = Array.from(new Set([...(blocked || []), domain]));
      await chrome.storage.sync.set({ blockedDomains: newBlocked });
      
      // Add domain to declarative net request rules for real-time blocking
      await addBlockingRule(domain);
      
      // Redirect to blocked interstitial
      await redirectToBlocked(tabId, url, score);
      return;
    }

    // For warnings/suggestions, send a message to content script to show an overlay
    // Score ranges: >90 allow silently, 50-75 alert, 10-40 high alert
    if (score > 90) {
      // Safe site - no warning needed, allow silently
      return;
    }

    let level;
    if (score >= 50 && score <= 75) {
      level = 'alert';           // 50-75: Show alert
    } else if (score >= 10 && score < 40) {
      level = 'high_alert';      // 10-40: High alert
    } else {
      // 76-90: Safe zone, no warning (already handled above)
      // <10: Permanent block (already handled above)
      return;
    }
    
    // Check if warnings are enabled
    if (!settingsCache.enableWarnings) return;
    
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'showWarning', score, level, url });
    } catch (e) {
      // content script may not be injected for some pages; ignore
    }
  } catch (e) {
    console.error('tabs.onUpdated handler error:', e);
  }
});

// Add domain to declarative net request blocking rules
async function addBlockingRule(domain) {
  try {
    // Get existing rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const nextId = existingRules.length > 0 ? Math.max(...existingRules.map(r => r.id)) + 1 : 2;
    
    // Add new blocking rule
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [{
        id: nextId,
        priority: 1,
        action: {
          type: 'block'
        },
        condition: {
          urlFilter: `*${domain}*`,
          resourceTypes: ['main_frame']
        }
      }]
    });
    
    console.log(`Added blocking rule for domain: ${domain}`);
  } catch (error) {
    console.error('Failed to add blocking rule:', error);
  }
}
