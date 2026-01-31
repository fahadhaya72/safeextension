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
});
