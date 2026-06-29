const menuBtn = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');

if (menuBtn && mobileMenu) {
  menuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('show');
  });
}

document.querySelectorAll('.feature-card, .arena-btn, .coin-pill, .cta-start, .cta-outline').forEach(el => {
  el.addEventListener('mouseenter', () => {
    el.style.transform = 'translateY(-3px)';
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
  });
});

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href');
    if (id && id !== '#') {
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({behavior:'smooth', block:'start'});
        mobileMenu?.classList.remove('show');
      }
    }
  });
});
