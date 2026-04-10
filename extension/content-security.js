// Content Security Inspector for SafeExtension
// Detects malicious overlays, fake login forms, and content-based threats

class ContentSecurityInspector {
  constructor() {
    this.threats = [];
    this.scanInterval = null;
    this.isEnabled = true;
    this.initialize();
  }

  async initialize() {
    // Wait for page to fully load
    if (document.readyState !== 'complete') {
      await new Promise(resolve => window.addEventListener('load', resolve));
    }

    // Start scanning for malicious content
    this.startContentScanning();
    
    // Listen for dynamic content changes
    this.observeContentChanges();
    
    // Report findings to background script
    this.reportThreats();
  }

  startContentScanning() {
    // Initial scan
    this.scanForMaliciousContent();
    
    // Periodic scans every 5 seconds
    this.scanInterval = setInterval(() => {
      this.scanForMaliciousContent();
    }, 5000);
  }

  scanForMaliciousContent() {
    this.threats = [];
    
    // Scan for invisible overlays
    this.detectInvisibleOverlays();
    
    // Scan for fake login forms
    this.detectFakeLoginForms();
    
    // Scan for credential harvesting
    this.detectCredentialHarvesting();
    
    // Scan for suspicious iframes
    this.detectSuspiciousIframes();
    
    // Scan for malicious scripts
    this.detectMaliciousScripts();
    
    // Scan for social engineering tactics
    this.detectSocialEngineering();
  }

  detectInvisibleOverlays() {
    const overlays = [];
    
    // Check for transparent overlays covering the page
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      // Check if element is positioned over content
      if (style.position === 'fixed' || style.position === 'absolute') {
        const isLargeOverlay = rect.width > window.innerWidth * 0.5 && 
                              rect.height > window.innerHeight * 0.5;
        const isInvisible = style.opacity === '0' || 
                           style.visibility === 'hidden' ||
                           style.display === 'none';
        
        if (isLargeOverlay && !isInvisible) {
          // Check for suspicious behavior
          const hasClickHandlers = element.onclick || element.addEventListener;
          const isTransparent = parseFloat(style.opacity) < 0.1;
          
          if (hasClickHandlers && isTransparent) {
            overlays.push({
              type: 'invisible_overlay',
              element: element,
              severity: 'high',
              description: 'Transparent overlay with click handlers detected'
            });
          }
        }
      }
    }
    
    this.threats.push(...overlays);
  }

  detectFakeLoginForms() {
    const forms = document.querySelectorAll('form');
    const fakeForms = [];
    
    for (const form of forms) {
      const threats = this.analyzeLoginForm(form);
      if (threats.length > 0) {
        fakeForms.push(...threats);
      }
    }
    
    this.threats.push(...fakeForms);
  }

  analyzeLoginForm(form) {
    const threats = [];
    const inputs = form.querySelectorAll('input[type="password"], input[type="email"], input[type="text"]');
    
    // Check for password fields on non-HTTPS pages
    if (location.protocol !== 'https:' && form.querySelector('input[type="password"]')) {
      threats.push({
        type: 'insecure_login',
        element: form,
        severity: 'high',
        description: 'Password form on non-HTTPS page'
      });
    }
    
    // Check for suspicious form attributes
    if (form.action && !form.action.includes(location.hostname)) {
      threats.push({
        type: 'external_form',
        element: form,
        severity: 'medium',
        description: 'Form submits to external domain'
      });
    }
    
    // Check for brand impersonation in form
    const formText = form.textContent.toLowerCase();
    const brands = ['google', 'facebook', 'amazon', 'microsoft', 'apple', 'paypal'];
    
    for (const brand of brands) {
      if (formText.includes(brand) && !location.hostname.includes(brand)) {
        threats.push({
          type: 'brand_impersonation',
          element: form,
          severity: 'high',
          description: `Form impersonating ${brand} brand`
        });
        break;
      }
    }
    
    // Check for urgency tactics
    const urgencyKeywords = ['urgent', 'immediate', 'suspend', 'limited', 'expire', 'verify now'];
    for (const keyword of urgencyKeywords) {
      if (formText.includes(keyword)) {
        threats.push({
          type: 'urgency_tactic',
          element: form,
          severity: 'medium',
          description: 'Urgency tactic detected in form'
        });
        break;
      }
    }
    
    return threats;
  }

  detectCredentialHarvesting() {
    const threats = [];
    
    // Check for multiple password fields
    const passwordFields = document.querySelectorAll('input[type="password"]');
    if (passwordFields.length > 1) {
      threats.push({
        type: 'multiple_passwords',
        severity: 'medium',
        description: 'Multiple password fields detected'
      });
    }
    
    // Check for sensitive fields on suspicious domains
    const sensitiveInputs = document.querySelectorAll('input[type="password"], input[name*="card"], input[name*="ssn"], input[name*="social"]');
    if (sensitiveInputs.length > 0 && this.isSuspiciousDomain()) {
      threats.push({
        type: 'sensitive_data_harvest',
        elements: Array.from(sensitiveInputs),
        severity: 'high',
        description: 'Sensitive data collection on suspicious domain'
      });
    }
    
    this.threats.push(...threats);
  }

  detectSuspiciousIframes() {
    const threats = [];
    const iframes = document.querySelectorAll('iframe');
    
    for (const iframe of iframes) {
      const src = iframe.src || iframe.getAttribute('data-src');
      
      // Check for hidden iframes
      const style = window.getComputedStyle(iframe);
      const isHidden = style.display === 'none' || 
                      style.visibility === 'hidden' ||
                      style.opacity === '0' ||
                      iframe.offsetHeight === 0;
      
      if (isHidden && src) {
        threats.push({
          type: 'hidden_iframe',
          element: iframe,
          severity: 'high',
          description: 'Hidden iframe detected'
        });
      }
      
      // Check for external iframes
      if (src && !src.includes(location.hostname)) {
        threats.push({
          type: 'external_iframe',
          element: iframe,
          severity: 'medium',
          description: 'External iframe detected'
        });
      }
    }
    
    this.threats.push(...threats);
  }

  detectMaliciousScripts() {
    const threats = [];
    const scripts = document.querySelectorAll('script');
    
    for (const script of scripts) {
      const content = script.textContent || script.innerHTML;
      
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /eval\s*\(/gi,
        /document\.write\s*\(/gi,
        /innerHTML\s*=/gi,
        /outerHTML\s*=/gi,
        /Function\s*\(/gi,
        /setTimeout\s*\(/gi,
        /setInterval\s*\(/gi
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          threats.push({
            type: 'suspicious_script',
            element: script,
            severity: 'medium',
            description: 'Suspicious JavaScript pattern detected'
          });
          break;
        }
      }
    }
    
    this.threats.push(...threats);
  }

  detectSocialEngineering() {
    const threats = [];
    
    // Check for fake security warnings
    const securityWarnings = document.querySelectorAll('[class*="security"], [class*="warning"], [class*="alert"]');
    for (const element of securityWarnings) {
      const text = element.textContent.toLowerCase();
      const fakeKeywords = ['virus detected', 'security breach', 'hack attempt', 'malware found'];
      
      for (const keyword of fakeKeywords) {
        if (text.includes(keyword)) {
          threats.push({
            type: 'fake_security_warning',
            element: element,
            severity: 'high',
            description: 'Fake security warning detected'
          });
          break;
        }
      }
    }
    
    // Check for fake download buttons
    const downloadButtons = document.querySelectorAll('button, a[download], .download');
    for (const button of downloadButtons) {
      const text = button.textContent.toLowerCase();
      const fakeDownloads = ['download now', 'free download', 'instant download'];
      
      for (const fake of fakeDownloads) {
        if (text.includes(fake) && !button.hasAttribute('download')) {
          threats.push({
            type: 'fake_download',
            element: button,
            severity: 'medium',
            description: 'Fake download button detected'
          });
          break;
        }
      }
    }
    
    this.threats.push(...threats);
  }

  isSuspiciousDomain() {
    const hostname = location.hostname.toLowerCase();
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\d+\.\d+\.\d+\.\d+/, // IP addresses
      /[0-9]{3,}/, // Lots of numbers
      /[^a-z0-9.-]/, // Special characters
      /\.tk$|\.ml$|\.ga$|\.cf$/ // Suspicious TLDs
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(hostname));
  }

  observeContentChanges() {
    const observer = new MutationObserver((mutations) => {
      let needsRescan = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          needsRescan = true;
        }
      });
      
      if (needsRescan) {
        // Debounce rescans
        clearTimeout(this.rescanTimeout);
        this.rescanTimeout = setTimeout(() => {
          this.scanForMaliciousContent();
          this.reportThreats();
        }, 1000);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  reportThreats() {
    if (this.threats.length === 0) return;
    
    // Calculate overall threat level
    const highThreats = this.threats.filter(t => t.severity === 'high').length;
    const mediumThreats = this.threats.filter(t => t.severity === 'medium').length;
    
    let overallRisk = 'low';
    if (highThreats > 0) {
      overallRisk = 'high';
    } else if (mediumThreats > 2) {
      overallRisk = 'medium';
    }
    
    // Send report to background script
    chrome.runtime.sendMessage({
      action: 'contentThreatReport',
      threats: this.threats,
      overallRisk,
      url: location.href,
      timestamp: Date.now()
    });
  }

  destroy() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    if (this.rescanTimeout) {
      clearTimeout(this.rescanTimeout);
    }
  }
}

// Initialize content security inspector
let inspector = null;

// Only run on main frame, not in iframes
if (window.top === window.self) {
  inspector = new ContentSecurityInspector();
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (inspector) {
      inspector.destroy();
    }
  });
}
