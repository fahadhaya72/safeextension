// Main landing page interactions
document.addEventListener('DOMContentLoaded', () => {
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

  document.querySelectorAll('.card, .step, .feature, .hero-right .mock').forEach(el => io.observe(el));

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

  // ===== URL CHECK FORM =====
  const API_BASE = 'https://safeextension-backend.onrender.com/api';
  const form = document.getElementById('landing-check-form');
  const urlInput = document.getElementById('landing-url');
  const loader = document.getElementById('landing-loader');
  const resultBox = document.getElementById('landing-result');

  console.log('[SafeExtension] Initialized. Form elements found:', !!form, !!urlInput, !!loader, !!resultBox);

  function showLoader() {
    if (loader) loader.classList.remove('hidden');
    if (resultBox) resultBox.classList.add('hidden');
  }

  function hideLoader() {
    if (loader) loader.classList.add('hidden');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getScoreClass(score) {
    if (typeof score !== 'number') return 'unknown';
    if (score >= 80) return 'safe';
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
          <strong>Recommendation:</strong> <em>${escapeHtml(String(action)).toUpperCase()}</em>
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

    html += '<h4 style="margin: 12px 0 8px; font-size: 0.95rem;">Raw API Response:</h4>';
    html += `<pre style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 0.85rem;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
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
        console.log('[SafeExtension] Calling API at:', `${API_BASE}/check-url`);

        const response = await fetch(`${API_BASE}/check-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
