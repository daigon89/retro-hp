/* ================================================
   Retro Corporate Site — Main JavaScript
   ================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ---- Opening Animation (v2) ----
  const openingV2 = document.querySelector('.opening-v2');
  if (openingV2) {
    document.body.classList.add('has-opening');
    const chars = openingV2.querySelectorAll('.opening-v2__text span');
    chars.forEach((char, i) => {
      char.style.animation = `charIn 0.4s ease ${0.5 + i * 0.05}s forwards`;
    });
    setTimeout(() => {
      document.body.classList.remove('has-opening');
      document.body.classList.add('opening-done');
      openingV2.classList.add('is-leaving');
    }, 2500);
    setTimeout(() => openingV2.remove(), 3300);
  }

  // ---- Legacy Opening Animation ----
  const opening = document.querySelector('.opening');
  if (opening) {
    document.body.classList.add('has-opening');
    setTimeout(() => {
      document.body.classList.remove('has-opening');
      document.body.classList.add('opening-done');
    }, 2600);
    setTimeout(() => {
      opening.remove();
    }, 3600);
  }

  // ---- Hero Slideshow ----
  const slides = document.querySelectorAll('.hero-slide__img');
  if (slides.length > 1) {
    let current = 0;
    setInterval(() => {
      slides[current].classList.remove('is-active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('is-active');
    }, 5000);
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
      const hero = document.querySelector('.hero') || document.querySelector('.hero-slide');
      if (hero) {
        const nextSection = hero.nextElementSibling;
        if (nextSection) {
          nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  // ---- Mamasapo nav active state ----
  const msNav = document.querySelector('.ms-nav');
  if (msNav) {
    const navLinks = msNav.querySelectorAll('a');
    const sections = [];
    navLinks.forEach(link => {
      const id = link.getAttribute('href').substring(1);
      const section = document.getElementById(id);
      if (section) sections.push({ link, section });
    });

    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(l => l.classList.remove('is-active'));
          const active = sections.find(s => s.section === entry.target);
          if (active) active.link.classList.add('is-active');
        }
      });
    }, { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' });

    sections.forEach(s => navObserver.observe(s.section));
  }
});
