// Background Service Worker for SafeExtension
// Handles messages and communicates between content scripts and popup

// 🔐 CONFIGURATION - Replace with your actual values
const CONFIG = {
  API_BASE_URL: 'https://safeextension-backend.onrender.com/api', // Production backend URL
  API_KEY: '20d429b06738d8a1d48ac296048b747259bf0993d9d9f3e951901dac69a21625', // Production API key
  EXTENSION_ID: 'your_extension_id_here' // Replace with your actual extension ID
};

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkURL') {
    checkURL(request.url)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function checkURL(url) {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/check-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.API_KEY,
        'x-extension-id': CONFIG.EXTENSION_ID
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key - please check configuration');
      } else if (response.status === 403) {
        throw new Error('Invalid extension ID - please check configuration');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded - please try again later');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Background API Error:', error);
    throw error;
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
      // Permanently block: store in chrome.storage.sync and redirect
      const newBlocked = Array.from(new Set([...(blocked || []), domain]));
      await chrome.storage.sync.set({ blockedDomains: newBlocked });
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
    
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'showWarning', score, level, url });
    } catch (e) {
      // content script may not be injected for some pages; ignore
    }
  } catch (e) {
    console.error('tabs.onUpdated handler error:', e);
  }
});
