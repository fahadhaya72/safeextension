// Popup script for SafeExtension
// Handles user interface and communicates with background script

class URLChecker {
  constructor() {
    this.lastResults = new Map();
    this.initializeElements();
    this.attachEventListeners();
    this.getCurrentTabUrl();
    this.loadBlockedDomains();
  }

  initializeElements() {
    this.urlInput = document.getElementById('urlInput');
    this.checkBtn = document.getElementById('checkBtn');
    this.loader = document.getElementById('loader');
    this.result = document.getElementById('result');
    this.error = document.getElementById('error');
    this.empty = document.getElementById('empty');
    this.copyBtn = document.getElementById('copyBtn');
    this.blockedList = document.getElementById('blockedList');
    this.refreshBlockedBtn = document.getElementById('refreshBlocked');

    // Settings elements
    this.settingsLink = document.getElementById('settingsLink');
    this.settingsPanel = document.getElementById('settingsPanel');
    this.closeSettings = document.getElementById('closeSettings');
    this.enableHighlighting = document.getElementById('enableHighlighting');
    this.showTrustBadges = document.getElementById('showTrustBadges');
    this.enableWarnings = document.getElementById('enableWarnings');
    this.autoBlock = document.getElementById('autoBlock');
    this.enableTelemetry = document.getElementById('enableTelemetry');
    this.saveSettings = document.getElementById('saveSettings');
    this.resetSettings = document.getElementById('resetSettings');
  }

  attachEventListeners() {
    this.checkBtn.addEventListener('click', () => this.checkURL());
    this.urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.checkURL();
    });
    this.copyBtn.addEventListener('click', () => this.copyResult());
    this.refreshBlockedBtn.addEventListener('click', () => this.loadBlockedDomains());

    // Settings event listeners
    this.settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.showSettingsPanel();
    });
    this.closeSettings.addEventListener('click', () => this.hideSettingsPanel());
    this.saveSettings.addEventListener('click', () => this.saveSettingsPanel());
    this.resetSettings.addEventListener('click', () => this.resetSettingsToDefaults());
  }

  getCurrentTabUrl() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        this.urlInput.value = tabs[0].url;
      }
    });
  }

  async checkURL() {
    const url = this.urlInput.value.trim();

    if (!url) {
      this.showError('Please enter a URL');
      return;
    }

    if (!this.isValidUrl(url)) {
      this.showError('Invalid URL format');
      return;
    }

    // Add protocol if missing
    const normalizedUrl = this.normalizeUrl(url);

    // Check cache
    const cached = this.lastResults.get(normalizedUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TIME) {
      this.displayResult(cached.data);
      return;
    }

    this.showLoader();

    try {
      // Use background script for secure API communication
      const response = await chrome.runtime.sendMessage({ action: 'checkURL', url: normalizedUrl });

      if (!response.success) {
        throw new Error(response.error || 'Failed to check URL');
      }

      const data = response.data;

      // Cache the result
      this.lastResults.set(normalizedUrl, {
        data,
        timestamp: Date.now()
      });

      this.displayResult(data);
    } catch (err) {
      console.error('Error:', err);
      this.showError(`Failed to check URL: ${err.message}`);
    }
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  normalizeUrl(url) {
    if (!url.match(/^https?:\/\//)) {
      return 'https://' + url;
    }
    return url;
  }

  displayResult(data) {
    this.hideAll();
    this.result.classList.remove('hidden');

    const { score, action, risk_classification, risk_factors, details, url } = data;

    // Update score circle
    const scoreCircle = document.getElementById('scoreCircle');
    const scoreValue = document.getElementById('scoreValue');
    scoreCircle.textContent = score;
    scoreCircle.className = 'score-circle ' + this.getScoreClass(score);

    // Update title
    document.getElementById('resultTitle').textContent = `${url}`;

    // Update risk level
    const riskLevel = document.getElementById('riskLevel');
    riskLevel.textContent = this.getRiskLevelText(risk_classification);
    riskLevel.className = 'risk-level ' + this.getActionClass(action);

    // Update recommendation
    const actionText = document.getElementById('actionText');
    actionText.textContent = this.getActionText(action);
    actionText.className = 'action-text ' + this.getActionClass(action);

    // Update risk factors
    const riskFactorsUl = document.getElementById('riskFactors');
    riskFactorsUl.innerHTML = '';
    if (risk_factors && risk_factors.length > 0) {
      risk_factors.forEach(factor => {
        const li = document.createElement('li');
        li.textContent = `${this.getFactorName(factor.code)} (${factor.points} pts)`;
        riskFactorsUl.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No major risk factors detected';
      riskFactorsUl.appendChild(li);
    }

    // Update technical details
    const detailsDiv = document.getElementById('details');
    detailsDiv.innerHTML = this.formatDetails(details);
  }

  getScoreClass(score) {
    if (score > 90) return 'safe';
    if (score >= 50) return 'warning';
    return 'danger';
  }

  getActionClass(action) {
    if (action === 'allow') return 'safe';
    if (action === 'warn') return 'warning';
    return 'danger';
  }

  getRiskLevelText(classification) {
    const map = {
      'low': 'Low Risk',
      'medium': 'Medium Risk',
      'high': 'High Risk'
    };
    return map[classification] || classification;
  }

  getActionText(action) {
    const map = {
      'allow': '✅ Safe to visit - No major risks detected',
      'warn': '⚠️ Caution - Some risks detected, proceed carefully',
      'block': '🚫 Dangerous - This URL may be malicious, do not visit'
    };
    return map[action] || 'Unable to determine safety';
  }

  getFactorName(code) {
    const map = {
      'NO_HTTPS': 'No HTTPS encryption',
      'YOUNG_DOMAIN': 'Recently registered domain',
      'LISTED_IN_FEEDS': 'Listed in threat feeds',
      'SUSPICIOUS_KEYWORDS': 'Suspicious keywords detected',
      'EXCESSIVE_REDIRECTS': 'Excessive redirects'
    };
    return map[code] || code;
  }

  formatDetails(details) {
    if (!details) return 'No additional details available';

    let html = '<ul style="margin-left: 15px;">';
    
    if (details.domainAgeDays !== null) {
      html += `<li>Domain age: ${details.domainAgeDays} days</li>`;
    }
    
    if (details.redirects !== undefined) {
      html += `<li>Redirects: ${details.redirects}</li>`;
    }
    
    if (details.safeBrowsing) {
      const sb = details.safeBrowsing;
      html += `<li>Safe Browsing: ${sb.listed ? 'Listed' : 'Not listed'}</li>`;
      if (sb.details && sb.details.length > 0) {
        html += '<li>Threat types: ' + sb.details.map(d => d.threatType).join(', ') + '</li>';
      }
    }
    
    html += '</ul>';
    return html;
  }

  copyResult() {
    const resultText = `${document.getElementById('resultTitle').textContent}\n` +
                      `${document.getElementById('riskLevel').textContent}\n` +
                      `Score: ${document.getElementById('scoreValue').textContent}/100`;
    
    navigator.clipboard.writeText(resultText).then(() => {
      const btn = this.copyBtn;
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    });
  }

  showLoader() {
    this.hideAll();
    this.loader.classList.remove('hidden');
    this.checkBtn.disabled = true;
  }

  showError(message) {
    this.hideAll();
    this.error.classList.remove('hidden');
    document.getElementById('errorText').textContent = message;
  }

  hideAll() {
    this.result.classList.add('hidden');
    this.error.classList.add('hidden');
    this.empty.classList.add('hidden');
    this.loader.classList.add('hidden');
    this.checkBtn.disabled = false;
  }
}

// Initialize when popup is opened
document.addEventListener('DOMContentLoaded', () => {
  const checker = new URLChecker();
  // load blocked domains for management
  if (checker && typeof checker.loadBlockedDomains === 'function') checker.loadBlockedDomains();
});

// Blocked domains management
URLChecker.prototype.loadBlockedDomains = function() {
  try {
    chrome.storage.local.get(['blockedDomains'], (res) => {
      const list = (res && res.blockedDomains) || [];
      this.renderBlockedList(list);
    });
  } catch (e) {
    console.warn('Failed to load blocked domains:', e);
    this.renderBlockedList([]);
  }
}

URLChecker.prototype.renderBlockedList = function(list) {
  if (!this.blockedList) return;
  this.blockedList.innerHTML = '';
  if (!list || list.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'No blocked sites';
    this.blockedList.appendChild(p);
    return;
  }

  const ul = document.createElement('ul');
  ul.style.paddingLeft = '14px';
  list.forEach(domain => {
    const li = document.createElement('li');
    li.style.marginBottom = '6px';
    const span = document.createElement('span');
    span.textContent = domain;
    span.style.marginRight = '8px';
    const btn = document.createElement('button');
    btn.textContent = 'Unblock';
    btn.style.padding = '4px 8px';
    btn.addEventListener('click', () => this.unblockDomain(domain));
    li.appendChild(span);
    li.appendChild(btn);
    ul.appendChild(li);
  });
  this.blockedList.appendChild(ul);
}

URLChecker.prototype.unblockDomain = function(domain) {
  try {
    chrome.storage.local.get(['blockedDomains'], (res) => {
      const list = (res && res.blockedDomains) || [];
      const updated = list.filter(d => d !== domain);
      chrome.storage.local.set({ blockedDomains: updated }, () => {
        this.loadBlockedDomains();
      });
    });
  } catch (e) {
    console.warn('Failed to unblock domain:', e);
  }
}

// Settings panel methods
URLChecker.prototype.showSettingsPanel = function() {
  this.loadSettings();
  this.settingsPanel.classList.remove('hidden');
}

URLChecker.prototype.hideSettingsPanel = function() {
  this.settingsPanel.classList.add('hidden');
}

URLChecker.prototype.loadSettings = function() {
  try {
    chrome.storage.sync.get({
      enableHighlighting: true,
      showTrustBadges: true,
      enableWarnings: true,
      autoBlock: true,
      enableTelemetry: true
    }, (settings) => {
      this.enableHighlighting.checked = settings.enableHighlighting;
      this.showTrustBadges.checked = settings.showTrustBadges;
      this.enableWarnings.checked = settings.enableWarnings;
      this.autoBlock.checked = settings.autoBlock;
      this.enableTelemetry.checked = settings.enableTelemetry;
    });
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
}

URLChecker.prototype.saveSettingsPanel = function() {
  const settings = {
    enableHighlighting: this.enableHighlighting.checked,
    showTrustBadges: this.showTrustBadges.checked,
    enableWarnings: this.enableWarnings.checked,
    autoBlock: this.autoBlock.checked,
    enableTelemetry: this.enableTelemetry.checked
  };

  try {
    chrome.storage.sync.set(settings, () => {
      this.hideSettingsPanel();
      // Notify background script of settings change
      chrome.runtime.sendMessage({ action: 'settingsUpdated', settings });
    });
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

URLChecker.prototype.resetSettingsToDefaults = function() {
  this.enableHighlighting.checked = true;
  this.showTrustBadges.checked = true;
  this.enableWarnings.checked = true;
  this.autoBlock.checked = true;
  this.enableTelemetry.checked = true;
}
