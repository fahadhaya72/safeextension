// Main landing page interactions
document.addEventListener('DOMContentLoaded', () => {
  // Check if running in file:// protocol and show warning
  if (window.location.protocol === 'file:') {
    console.warn('⚠️ Running in file:// protocol. Some features may not work properly.');
    console.warn('💡 Use a local server: python server.py or start-server.bat');
  }

  // Smooth scroll for hash links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Intersection observer for scroll animations
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('in-view'), 40 + Math.round(Math.random() * 120));
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.url-checker-card, .enhanced-step, .enhanced-feature, .hero-right .enhanced-card').forEach(el => io.observe(el));

  // Focus visible for keyboard users
  document.body.addEventListener('keyup', (e) => {
    if (e.key === 'Tab') document.body.classList.add('show-focus');
  });

  // Gentle floating for blob
  const blob = document.querySelector('.blob');
  if (blob) {
    let t = 0;
    function float() {
      t += 0.01;
      const y = Math.sin(t) * 4;
      blob.style.transform = `translateY(${y}px) rotate(${Math.sin(t/2) * 2}deg)`;
      requestAnimationFrame(float);
    }
    requestAnimationFrame(float);
  }

  // Enhanced button interactions
  const checkBtn = document.getElementById('landing-check-btn');
  if (checkBtn) {
    checkBtn.addEventListener('mouseenter', () => {
      checkBtn.style.transform = 'translateY(-2px)';
    });
    checkBtn.addEventListener('mouseleave', () => {
      checkBtn.style.transform = 'translateY(0)';
    });
  }

  // ===== URL CHECK FORM =====
  const CONFIG = {
    API_BASE: 'https://safeextension-backend.onrender.com/api', // Production backend URL
    API_KEY: '20d429b06738d8a1d48ac296048b747259bf0993d9d9f3e951901dac69a21625', // Your API key
    EXTENSION_ID: 'web' // Web frontend identifier
  };
  
  const form = document.getElementById('landing-check-form');
  const urlInput = document.getElementById('landing-url');
  const loader = document.getElementById('landing-loader');
  const resultBox = document.getElementById('landing-result');

  console.log('[SafeExtension] Initialized. Form elements found:', !!form, !!urlInput, !!loader, !!resultBox);

  function showLoader() {
    if (loader) loader.classList.remove('hidden');
    if (resultBox) resultBox.classList.add('hidden');
    // Update button state
    if (checkBtn) {
      const btnText = checkBtn.querySelector('.btn-text');
      const btnLoader = checkBtn.querySelector('.btn-loader');
      if (btnText) btnText.style.display = 'none';
      if (btnLoader) btnLoader.style.display = 'inline';
      checkBtn.disabled = true;
    }
  }

  function hideLoader() {
    if (loader) loader.classList.add('hidden');
    // Reset button state
    if (checkBtn) {
      const btnText = checkBtn.querySelector('.btn-text');
      const btnLoader = checkBtn.querySelector('.btn-loader');
      if (btnText) btnText.style.display = 'inline';
      if (btnLoader) btnLoader.style.display = 'none';
      checkBtn.disabled = false;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getActionDescription(action) {
    const descriptions = {
      'allow': '✅ Safe to visit',
      'alert': '⚠️ Proceed with caution',
      'high_alert': '🔴 High risk - be very careful',
      'block': '🚫 Dangerous - do not visit'
    };
    return descriptions[action] || '❓ Unknown status';
  }

  function getScoreClass(score) {
    if (typeof score !== 'number') return 'unknown';
    if (score >= 90) return 'safe';
    if (score >= 50) return 'warning';
    return 'danger';
  }

  function renderResult(data) {
    console.log('[SafeExtension] Rendering result:', data);
    if (!resultBox) {
      console.error('[SafeExtension] Result box not found!');
      return;
    }

    const score = typeof data.score === 'number' ? data.score : 'N/A';
    const action = data.action || 'unknown';
    const details = data.details || {};
    const url = data.url || urlInput.value;

    let html = `
      <div class="card result-card">
        <h3>🔍 Result for <span class="mono">${escapeHtml(url)}</span></h3>
        <p style="margin: 12px 0;">
          <strong>Safety Score:</strong> 
          <span class="score ${getScoreClass(score)}">${score}/100</span>
        </p>
        <p style="margin: 8px 0;">
          <strong>Recommendation:</strong> ${getActionDescription(action)}
        </p>
    `;

    if (Object.keys(details).length > 0) {
      html += '<h4 style="margin: 12px 0 8px; font-size: 0.95rem;">Details:</h4><ul>';
      if (details.domainAgeDays !== null && details.domainAgeDays !== undefined) {
        html += `<li><strong>Domain Age:</strong> ${details.domainAgeDays} days</li>`;
      }
      if (details.redirects !== undefined) {
        html += `<li><strong>Redirects:</strong> ${details.redirects}</li>`;
      }
      if (details.safeBrowsing) {
        const sb = details.safeBrowsing;
        html += `<li><strong>Safe Browsing:</strong> ${sb.listed ? '⚠️ Listed' : '✓ Clean'}</li>`;
      }
      html += '</ul>';
    }

    html += '</div>';
    resultBox.innerHTML = html;
    resultBox.classList.remove('hidden');
  }

  if (form && urlInput) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const url = (urlInput.value || '').trim();
      
      console.log('[SafeExtension] Form submitted with URL:', url);

      if (!url) {
        if (resultBox) {
          resultBox.innerHTML = '<div class="card error">⚠️ Please enter a URL</div>';
          resultBox.classList.remove('hidden');
        }
        return;
      }

      showLoader();

      try {
        // Fix URL normalization: handle cases like "https:domain.com" or "https:/domain.com"
        let normalized = url;
        if (!normalized.match(/^https?:\/\//)) {
          // Fix common mistakes: "https:domain.com" → "https://domain.com"
          normalized = normalized.replace(/^(https?):([^/])/, '$1://$2');
          // If still no protocol, add https://
          if (!normalized.match(/^https?:\/\//)) {
            normalized = 'https://' + normalized;
          }
        }
        console.log('[SafeExtension] Normalized URL:', normalized);
        console.log('[SafeExtension] Calling API at:', `${CONFIG.API_BASE}/check-url`);

        const response = await fetch(`${CONFIG.API_BASE}/check-url`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': CONFIG.API_KEY,
            'x-extension-id': CONFIG.EXTENSION_ID
          },
          body: JSON.stringify({ url: normalized })
        });

        console.log('[SafeExtension] API Response:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('[SafeExtension] API Data:', data);
        renderResult(data);
      } catch (err) {
        console.error('[SafeExtension] Error:', err);
        if (resultBox) {
          resultBox.innerHTML = `<div class="card error">❌ ${escapeHtml(err.message || 'Failed to check URL')}</div>`;
          resultBox.classList.remove('hidden');
        }
      } finally {
        hideLoader();
      }
    });
  } else {
    console.error('[SafeExtension] Form or input not found!');
  }
});
