/* ================================================
   Retro Corporate Site — Main JavaScript
   ================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ---- Opening Animation ----
  const opening = document.querySelector('.opening');
  if (opening) {
    document.body.classList.add('has-opening');

    // After opening animations finish, reveal content
    setTimeout(() => {
      document.body.classList.remove('has-opening');
      document.body.classList.add('opening-done');
    }, 2600);

    // Remove overlay DOM after exit animation
    setTimeout(() => {
      opening.remove();
    }, 3600);
  }

  // ---- Header scroll behavior ----
  const header = document.querySelector('.site-header');
  let lastScrollY = 0;
  let ticking = false;

  function updateHeader() {
    const currentY = window.scrollY;

    if (currentY > 80) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }

    if (currentY > lastScrollY && currentY > 200) {
      header.classList.add('is-hidden');
    } else {
      header.classList.remove('is-hidden');
    }

    lastScrollY = currentY;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive: true });

  // ---- Hamburger menu ----
  const hamburger = document.querySelector('.hamburger');
  const spMenu = document.querySelector('.sp-menu');

  if (hamburger && spMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('is-active');
      spMenu.classList.toggle('is-open');
      document.body.style.overflow = spMenu.classList.contains('is-open') ? 'hidden' : '';
    });

    spMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('is-active');
        spMenu.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  // ---- Scroll animations (IntersectionObserver) ----
  const observerOptions = {
    threshold: 0.2,
    rootMargin: '0px 0px -40px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.setAttribute('data-shown', '1');
        }, Number(delay));
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.js-visible').forEach(el => {
    observer.observe(el);
  });

  // ---- Smooth scroll for anchor links ----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ---- Hero 2nd screen fade-in ----
  const heroSecond = document.querySelector('.ms-hero-screen--second');
  if (heroSecond) {
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          heroSecond.classList.add('is-visible');
          heroObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    heroObserver.observe(heroSecond);
  }

  // ---- FAQ Accordion ----
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('is-open');
      // Close all
      document.querySelectorAll('.faq-item.is-open').forEach(el => el.classList.remove('is-open'));
      // Toggle current
      if (!isOpen) item.classList.add('is-open');
    });
  });

  // ---- Scroll-down button ----
  const scrollDownBtn = document.querySelector('.scroll-down');
  if (scrollDownBtn) {
    scrollDownBtn.addEventListener('click', () => {
      const hero = document.querySelector('.hero');
      if (hero) {
        const nextSection = hero.nextElementSibling;
        if (nextSection) {
          nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }
});
