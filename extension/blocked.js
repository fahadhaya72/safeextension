document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const original = params.get('url') || '';
  const score = params.get('score') || '';

  document.getElementById('site').textContent = original;
  document.getElementById('score').textContent = score;

  document.getElementById('goBack').addEventListener('click', () => {
    // Navigate current tab to a safe page
    try {
      chrome.tabs.update({ url: 'https://www.google.com' });
    } catch (e) {
      // Fallback: open google in this window
      window.location.href = 'https://www.google.com';
    }
  });

  document.getElementById('report').addEventListener('click', () => {
    const mailto = `mailto:support@example.com?subject=False%20positive%20report&body=Blocked%20site:%20${encodeURIComponent(original)}%0AScore:%20${encodeURIComponent(score)}`;
    window.location.href = mailto;
  });
});
