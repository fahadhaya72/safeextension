document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const original = params.get('url') || '';
  const score = params.get('score') || '0';

  // Update page elements
  document.getElementById('site').textContent = new URL(original).hostname || original;
  document.getElementById('score').textContent = score;
  document.getElementById('scoreDetail').textContent = score;

  // Set block reason based on score
  const reasonElement = document.getElementById('reason');
  if (score < 5) {
    reasonElement.textContent = 'Critical security threat - Malware/Phishing detected';
  } else if (score < 10) {
    reasonElement.textContent = 'High risk - Multiple severe security issues detected';
  } else {
    reasonElement.textContent = 'Security risks detected - Automatic protection applied';
  }

  // Go back to safety
  document.getElementById('goBack').addEventListener('click', () => {
    try {
      chrome.tabs.update({ url: 'https://www.google.com' });
    } catch (e) {
      window.location.href = 'https://www.google.com';
    }
  });

  // Report false positive
  document.getElementById('report').addEventListener('click', () => {
    const subject = encodeURIComponent('SafeExtension False Positive Report');
    const body = encodeURIComponent(
      `Blocked Site: ${original}\n` +
      `Risk Score: ${score}/100\n` +
      `User Agent: ${navigator.userAgent}\n` +
      `Timestamp: ${new Date().toISOString()}\n\n` +
      `Please review this block classification.`
    );
    window.location.href = `mailto:support@safeextension.com?subject=${subject}&body=${body}`;
  });

  // Toggle more information
  document.getElementById('moreInfo').addEventListener('click', () => {
    const details = document.getElementById('warningDetails');
    const isVisible = details.style.display !== 'none';
    details.style.display = isVisible ? 'none' : 'block';
    
    const button = document.getElementById('moreInfo');
    button.textContent = isVisible ? 'ℹ️ Learn More' : '❌ Hide Details';
  });

  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('goBack').click();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      document.getElementById('report').click();
    }
  });

  // Log the block for analytics (optional)
  console.log('SafeExtension: Site blocked', {
    url: original,
    score: parseInt(score),
    timestamp: new Date().toISOString()
  });
});
