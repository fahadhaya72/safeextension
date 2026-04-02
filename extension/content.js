// Content Script for SafeExtension
// Runs on web pages to detect and highlight suspicious links

class ContentScriptChecker {
  constructor() {
    this.cache = new Map();
    this.settings = {
      enableHighlighting: true,
      showTrustBadges: true,
      enableWarnings: true
    };
    this.initialize();
  }

  async initialize() {
    await this.loadSettings();
    // Scan page for links
    this.scanPageLinks();
    
    // Watch for dynamically added links
    this.observeDOM();
    
    // Listen for right-click context menu
    this.setupContextMenu();
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response && response.settings) {
        this.settings = response.settings;
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  scanPageLinks() {
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        this.processLink(link);
      }
    });
  }

  observeDOM() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              const links = node.querySelectorAll ? node.querySelectorAll('a[href]') : [];
              links.forEach(link => this.processLink(link));
              if (node.tagName === 'A') {
                this.processLink(node);
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  }

  processLink(link) {
    const href = link.getAttribute('href');
    if (!href || link.dataset.safeExtensionProcessed) return;

    link.dataset.safeExtensionProcessed = 'true';

    // Add hover event to show status
    link.addEventListener('mouseenter', () => this.onLinkHover(link, href), false);
  }

  async onLinkHover(link, href) {
    // Check cache first
    const cached = this.cache.get(href);
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) { // 10 minutes
      this.highlightLink(link, cached.data);
      return;
    }

    try {
      // Use background script for secure API calls
      const response = await chrome.runtime.sendMessage({ action: 'checkURL', url: href });
      if (response.success) {
        const data = response.data;
        this.cache.set(href, { data, timestamp: Date.now() });
        this.highlightLink(link, data);
      }
    } catch (error) {
      console.warn('Link check failed:', error);
    }
  }

  highlightLink(link, result) {
    if (!result) return;

    const action = result.action;
    const score = result.score;

    // Check if highlighting is enabled
    if (!this.settings.enableHighlighting) return;

    // Remove previous classes and badges
    link.classList.remove('safe-ext-safe', 'safe-ext-warn', 'safe-ext-danger');
    const existingBadge = link.querySelector('.safe-ext-badge');
    if (existingBadge) existingBadge.remove();

    // Add appropriate class
    if (action === 'allow') {
      link.classList.add('safe-ext-safe');
      link.title = `SafeExtension: Safe (${score}/100)`;
      if (this.settings.showTrustBadges) {
        this.addTrustBadge(link, score);
      }
    } else if (action === 'warn') {
      link.classList.add('safe-ext-warn');
      link.title = `SafeExtension: Warning (${score}/100)`;
    } else {
      link.classList.add('safe-ext-danger');
      link.title = `SafeExtension: Dangerous (${score}/100)`;
    }
  }

  addTrustBadge(link, score) {
    // Only add badge for very safe sites (score > 95)
    if (score <= 95) return;

    const badge = document.createElement('span');
    badge.className = 'safe-ext-badge';
    badge.textContent = '🛡️';
    badge.title = `Verified Safe (${score}/100)`;
    badge.style.cssText = `
      display: inline-block;
      margin-left: 4px;
      font-size: 12px;
      vertical-align: middle;
      opacity: 0.8;
      transition: opacity 0.2s;
    `;

    // Position badge after link text
    link.appendChild(badge);
  }

  setupContextMenu() {
    document.addEventListener('contextmenu', (e) => {
      if (e.target.tagName === 'A') {
        const href = e.target.getAttribute('href');
        if (href) {
          chrome.runtime.sendMessage(
            { action: 'checkURL', url: href },
            (response) => {
              if (response.success) {
                console.log('Link check result:', response.data);
              }
            }
          );
        }
      }
    });
  }
}

// Initialize content script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentScriptChecker();
  });
} else {
  new ContentScriptChecker();
}

// Inject inline styles for link highlighting
const style = document.createElement('style');
style.textContent = `
  a.safe-ext-safe {
    border-bottom: 2px solid #10b981 !important;
  }
  
  a.safe-ext-warn {
    border-bottom: 2px dashed #f59e0b !important;
  }
  
  a.safe-ext-danger {
    border-bottom: 2px solid #ef4444 !important;
    background-color: rgba(239, 68, 68, 0.1) !important;
  }
`;
document.head.appendChild(style);

// Listen for messages from background to show warnings/interstitials
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.action !== 'showWarning') return;
  const { score, level, url } = message;
  showWarningOverlay(score, level, url);
});

function showWarningOverlay(score, level, url) {
  try {
    // Avoid duplicate overlays
    if (document.getElementById('safe-ext-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'safe-ext-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.zIndex = '9999999999';
    overlay.style.color = '#fff';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.height = '100vh';

    // Color scheme based on risk level
    const colors = {
      alert: { bg: 'rgba(245, 158, 11, 0.9)', box: '#f59e0b', text: '#fff' },
      high_alert: { bg: 'rgba(239, 68, 68, 0.9)', box: '#ef4444', text: '#fff' },
      block: { bg: 'rgba(127, 29, 29, 0.9)', box: '#991b1b', text: '#fff' }
    };

    const color = colors[level] || colors.alert;
    overlay.style.background = color.bg;

    const box = document.createElement('div');
    box.style.background = color.box;
    box.style.padding = '24px';
    box.style.borderRadius = '12px';
    box.style.maxWidth = '720px';
    box.style.width = '90%';
    box.style.boxShadow = '0 10px 32px rgba(0,0,0,0.5)';
    box.style.textAlign = 'center';

    const title = document.createElement('h2');
    title.style.marginTop = '0';
    title.style.fontSize = '24px';
    title.style.fontWeight = 'bold';
    
    const messages = {
      alert: '⚠️ Medium Risk Site Detected',
      high_alert: '🔴 High Risk Site Detected', 
      block: '🚫 Dangerous Site Blocked'
    };
    title.textContent = messages[level] || messages.alert;

    const p = document.createElement('p');
    p.style.fontSize = '16px';
    p.style.marginBottom = '20px';
    p.textContent = `This site (${new URL(url).hostname}) has a safety score of ${score}/100.`;

    const description = document.createElement('p');
    description.style.fontSize = '14px';
    description.style.marginBottom = '24px';
    description.style.opacity = '0.9';
    
    const descriptions = {
      alert: 'This site shows some warning signs but may be legitimate. Proceed with caution.',
      high_alert: 'This site exhibits multiple risk factors. Navigation is strongly discouraged.',
      block: 'This site has been permanently blocked due to severe security risks.'
    };
    description.textContent = descriptions[level] || descriptions.alert;

    const btns = document.createElement('div');
    btns.style.display = 'flex';
    btns.style.gap = '12px';
    btns.style.justifyContent = 'center';
    btns.style.marginTop = '20px';

    const backBtn = document.createElement('button');
    backBtn.textContent = 'Go Back (Safer)';
    backBtn.style.padding = '10px 20px';
    backBtn.style.border = 'none';
    backBtn.style.borderRadius = '6px';
    backBtn.style.cursor = 'pointer';
    backBtn.style.fontSize = '14px';
    backBtn.style.fontWeight = '600';
    backBtn.style.background = 'rgba(255,255,255,0.2)';
    backBtn.style.color = '#fff';
    backBtn.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'https://www.google.com';
      }
    });

    const proceedBtn = document.createElement('button');
    proceedBtn.textContent = level === 'block' ? 'Understood' : 'Proceed Anyway';
    proceedBtn.style.padding = '10px 20px';
    proceedBtn.style.border = 'none';
    proceedBtn.style.borderRadius = '6px';
    proceedBtn.style.cursor = 'pointer';
    proceedBtn.style.fontSize = '14px';
    proceedBtn.style.fontWeight = '600';
    proceedBtn.style.background = 'rgba(255,255,255,0.9)';
    proceedBtn.style.color = color.box;
    proceedBtn.addEventListener('click', () => {
      const el = document.getElementById('safe-ext-overlay');
      if (el) el.remove();
    });

    btns.appendChild(backBtn);
    btns.appendChild(proceedBtn);

    box.appendChild(title);
    box.appendChild(p);
    box.appendChild(description);
    box.appendChild(btns);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Auto-dismiss for alerts after 15 seconds
    if (level === 'alert') {
      setTimeout(() => {
        const el = document.getElementById('safe-ext-overlay');
        if (el) el.remove();
      }, 15000);
    }
  } catch (e) {
    console.error('Failed to show overlay:', e);
  }
}
