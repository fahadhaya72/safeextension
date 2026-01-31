// Content Script for SafeExtension
// Runs on web pages to detect and highlight suspicious links

const API_BASE_URL = 'http://localhost:4000/api';
const CACHE_TIME = 10 * 60 * 1000; // 10 minutes

class ContentScriptChecker {
  constructor() {
    this.cache = new Map();
    this.initialize();
  }

  initialize() {
    // Scan page for links
    this.scanPageLinks();
    
    // Watch for dynamically added links
    this.observeDOM();
    
    // Listen for right-click context menu
    this.setupContextMenu();
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
    if (cached && Date.now() - cached.timestamp < CACHE_TIME) {
      this.highlightLink(link, cached.data);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/check-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: href })
      });

      if (response.ok) {
        const data = await response.json();
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

    // Remove previous classes
    link.classList.remove('safe-ext-safe', 'safe-ext-warn', 'safe-ext-danger');

    // Add appropriate class
    if (action === 'allow') {
      link.classList.add('safe-ext-safe');
      link.title = `SafeExtension: Safe (${score}/100)`;
    } else if (action === 'warn') {
      link.classList.add('safe-ext-warn');
      link.title = `SafeExtension: Warning (${score}/100)`;
    } else {
      link.classList.add('safe-ext-danger');
      link.title = `SafeExtension: Dangerous (${score}/100)`;
    }
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
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.color = '#fff';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.height = '100vh';

    const box = document.createElement('div');
    box.style.background = '#111';
    box.style.padding = '20px';
    box.style.borderRadius = '8px';
    box.style.maxWidth = '720px';
    box.style.width = '90%';
    box.style.boxShadow = '0 6px 24px rgba(0,0,0,0.5)';

    const title = document.createElement('h2');
    title.textContent = level === 'suggest' ? 'Potentially Dangerous Site' : 'Warning: Risky Site Detected';
    title.style.marginTop = '0';

    const p = document.createElement('p');
    p.textContent = `This site (${url}) has a safety score of ${score}/100.`;

    const btns = document.createElement('div');
    btns.style.display = 'flex';
    btns.style.gap = '12px';
    btns.style.marginTop = '12px';

    const backBtn = document.createElement('button');
    backBtn.textContent = 'Go Back (Safer)';
    backBtn.style.padding = '8px 12px';
    backBtn.style.cursor = 'pointer';
    backBtn.addEventListener('click', () => {
      // Try go back in history; if not possible, navigate to search
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'https://www.google.com';
      }
    });

    const proceedBtn = document.createElement('button');
    proceedBtn.textContent = 'Proceed Anyway';
    proceedBtn.style.padding = '8px 12px';
    proceedBtn.style.cursor = 'pointer';
    proceedBtn.addEventListener('click', () => {
      const el = document.getElementById('safe-ext-overlay');
      if (el) el.remove();
    });

    btns.appendChild(backBtn);
    btns.appendChild(proceedBtn);

    box.appendChild(title);
    box.appendChild(p);
    box.appendChild(btns);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  } catch (e) {
    console.error('Failed to show overlay:', e);
  }
}
