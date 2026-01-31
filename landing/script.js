// Small enhancements: smooth scroll and focus-visible hint for keyboard users
document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for hash links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Add a class when keyboard navigation is detected to show focus styles
  function handleFirstTab(e) {
    if (e.key === 'Tab') {
      document.documentElement.classList.add('show-focus');
      window.removeEventListener('keydown', handleFirstTab);
    }
  }
  window.addEventListener('keydown', handleFirstTab);
});
// Lightweight script to add in-view animations and small interactions
document.addEventListener('DOMContentLoaded', () => {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        // add a tiny randomized delay for a handcrafted feel
        setTimeout(() => e.target.classList.add('in-view'), 40 + Math.round(Math.random() * 120));
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.card, .step, .feature, .hero-right .mock').forEach(el => io.observe(el));

  // Smooth scroll for nav links with slight offset
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Minimal accessibility: focus outlines for keyboard users
  document.body.addEventListener('keyup', (e) => {
    if (e.key === 'Tab') document.body.classList.add('show-focus');
  });

  // Gentle floating for blob to feel alive
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

  // --- Landing page URL check (inline)
  const API_BASE = 'https://safeextension-backend.onrender.com/api';
  const form = document.getElementById('landing-check-form');
  const urlInput = document.getElementById('landing-url');
  const loader = document.getElementById('landing-loader');
  const resultBox = document.getElementById('landing-result');

  function showLoader() {
    if (loader) loader.classList.remove('hidden');
    if (resultBox) resultBox.classList.add('hidden');
  }
  function hideLoader() {
    if (loader) loader.classList.add('hidden');
  }
  function renderResult(data) {
    if (!resultBox) return;
    resultBox.classList.remove('hidden');
    const score = data.score ?? 'N/A';
    const action = data.action ?? 'unknown';
    const details = data.details || {};
    let html = `<div class="card result-card">
      <h3>Result for <span class="mono">${escapeHtml(data.url || urlInput.value)}</span></h3>
      <p><strong>Score:</strong> <span class="score ${getScoreClass(score)}">${score}</span> — <em>${action}</em></p>
      <ul>`;
    if (details.domainAgeDays !== null && details.domainAgeDays !== undefined) html += `<li>Domain age: ${details.domainAgeDays} days</li>`;
    if (details.redirects !== undefined) html += `<li>Redirects: ${details.redirects}</li>`;
    if (details.safeBrowsing) html += `<li>Safe Browsing: ${details.safeBrowsing.listed ? 'Listed' : 'Not listed'}</li>`;
    html += `</ul></div>`;
    resultBox.innerHTML = html;
  }

  function getScoreClass(score) {
    if (typeof score !== 'number') return 'unknown';
    if (score >= 80) return 'safe';
    if (score >= 50) return 'warning';
    return 'danger';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]);
  }

  if (form) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const url = (urlInput && urlInput.value || '').trim();
      if (!url) return;
      showLoader();
      try {
        const normalized = url.match(/^https?:\/\//) ? url : 'https://' + url;
        const resp = await fetch(`${API_BASE}/check-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalized })
        });
        if (!resp.ok) throw new Error('API error ' + resp.status);
        const data = await resp.json();
        renderResult(data);
      } catch (err) {
        if (resultBox) resultBox.innerHTML = `<div class="card error">Unable to check URL: ${escapeHtml(err.message || String(err))}</div>`;
        if (resultBox) resultBox.classList.remove('hidden');
      } finally {
        hideLoader();
      }
    });
  }
});
