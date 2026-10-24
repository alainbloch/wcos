/**
 * WCoS Main JavaScript
 * Handles navigation, dropdowns, search, and interactive elements
 */

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initDropdowns();
  initSearch();
  initSmoothScroll();
  initAnimations();
});

/* ==========================================================================
   Mobile Menu
   ========================================================================== */
function initMobileMenu() {
  const toggle = document.querySelector('.mobile-menu-toggle');
  const menu = document.getElementById('nav-menu');

  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', !expanded);
    menu.classList.toggle('open');
    document.body.style.overflow = expanded ? '' : 'hidden';
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('open');
      document.body.style.overflow = '';
      toggle.focus();
    }
  });
}

/* ==========================================================================
   Dropdown Menus
   ========================================================================== */
function initDropdowns() {
  const dropdowns = document.querySelectorAll('.nav-item.has-dropdown');

  dropdowns.forEach((dropdown) => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');

    if (!toggle || !menu) return;

    // Keyboard navigation
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleDropdown(dropdown, !dropdown.hasAttribute('aria-expanded'));
      } else if (e.key === 'Escape') {
        closeDropdown(dropdown);
        toggle.focus();
      }
    });

    // Hover for desktop
    dropdown.addEventListener('mouseenter', () => {
      if (window.innerWidth > 768) {
        openDropdown(dropdown);
      }
    });

    dropdown.addEventListener('mouseleave', () => {
      if (window.innerWidth > 768) {
        closeDropdown(dropdown);
      }
    });

    // Focus management for accessibility
    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('focus', () => openDropdown(dropdown));
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-item.has-dropdown')) {
      document.querySelectorAll('.nav-item.has-dropdown[aria-expanded="true"]').forEach(closeDropdown);
    }
  });
}

function openDropdown(dropdown) {
  dropdown.setAttribute('aria-expanded', 'true');
  const toggle = dropdown.querySelector('.dropdown-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
}

function closeDropdown(dropdown) {
  dropdown.removeAttribute('aria-expanded');
  const toggle = dropdown.querySelector('.dropdown-toggle');
  if (toggle) toggle.removeAttribute('aria-expanded');
}

function toggleDropdown(dropdown, force) {
  const isOpen = dropdown.hasAttribute('aria-expanded');
  if (force !== undefined) {
    force ? openDropdown(dropdown) : closeDropdown(dropdown);
  } else {
    isOpen ? closeDropdown(dropdown) : openDropdown(dropdown);
  }
}

/* ==========================================================================
   Search
   ========================================================================== */
function initSearch() {
  const searchInput = document.getElementById('search-input');
  const searchForm = document.querySelector('.search-form');

  if (!searchInput || !searchForm) return;

  let searchTimeout;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = searchInput.value.trim();
      if (query.length >= 2) {
        performSearch(query);
      } else {
        clearSearchResults();
      }
    }, 300);
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
      window.location.href = `/search?q=${encodeURIComponent(query)}`;
    }
  });
}

async function performSearch(query) {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    renderSearchResults(data.results);
  } catch (error) {
    console.error('Search error:', error);
  }
}

function renderSearchResults(results) {
  // Implement search results dropdown
  console.log('Search results:', results);
}

function clearSearchResults() {
  // Clear search results dropdown
}

/* ==========================================================================
   Smooth Scroll
   ========================================================================== */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const headerOffset = 100;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });

        target.focus({ preventScroll: true });
      }
    });
  });
}

/* ==========================================================================
   Scroll Animations
   ========================================================================== */
function initAnimations() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    }
  );

  document.querySelectorAll('.section, .card, .stat-card').forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

// Add animation class
const style = document.createElement('style');
style.textContent = `
  .animate-in {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
`;
document.head.appendChild(style);

/* ==========================================================================
   Utility Functions
   ========================================================================== */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/* ==========================================================================
   Flash Message Auto-dismiss
   ========================================================================== */
document.querySelectorAll('.alert').forEach((alert) => {
  setTimeout(() => {
    alert.style.opacity = '0';
    alert.style.transform = 'translateY(-10px)';
    setTimeout(() => alert.remove(), 300);
  }, 5000);
});

/* ==========================================================================
   Table Sorting (Simple)
   ========================================================================== */
document.querySelectorAll('.table th[data-sort]').forEach((th) => {
  th.style.cursor = 'pointer';
  th.addEventListener('click', () => {
    const table = th.closest('.table');
    const tbody = table.querySelector('tbody');
    const columnIndex = Array.from(th.parentNode.children).indexOf(th);
    const isAsc = th.classList.toggle('sort-asc');
    th.classList.toggle('sort-desc', !isAsc);

    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a, b) => {
      const aText = a.children[columnIndex].textContent.trim();
      const bText = b.children[columnIndex].textContent.trim();
      return isAsc ? aText.localeCompare(bText) : bText.localeCompare(aText);
    });

    rows.forEach((row) => tbody.appendChild(row));
  });
});

/* ==========================================================================
   Accordion (for Core Moves, etc.)
   ========================================================================== */
document.querySelectorAll('.accordion-trigger').forEach((trigger) => {
  trigger.addEventListener('click', () => {
    const panel = trigger.nextElementSibling;
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';

    trigger.setAttribute('aria-expanded', !isOpen);
    panel.hidden = isOpen;

    if (!isOpen) {
      panel.style.maxHeight = panel.scrollHeight + 'px';
    } else {
      panel.style.maxHeight = '0';
    }
  });
});

/* ==========================================================================
   Form Validation
   ========================================================================== */
document.querySelectorAll('form[data-validate]').forEach((form) => {
  form.addEventListener('submit', (e) => {
    let valid = true;
    const requiredFields = form.querySelectorAll('[required]');

    requiredFields.forEach((field) => {
      if (!field.value.trim()) {
        showFieldError(field, 'This field is required');
        valid = false;
      } else {
        clearFieldError(field);
      }

      if (field.type === 'email' && field.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
          showFieldError(field, 'Please enter a valid email address');
          valid = false;
        }
      }
    });

    if (!valid) {
      e.preventDefault();
      const firstError = form.querySelector('.form-error');
      if (firstError) firstError.focus();
    }
  });
});

function showFieldError(field, message) {
  clearFieldError(field);
  field.classList.add('error');
  const errorEl = document.createElement('div');
  errorEl.className = 'form-error';
  errorEl.textContent = message;
  field.parentNode.appendChild(errorEl);
}

function clearFieldError(field) {
  field.classList.remove('error');
  const errorEl = field.parentNode.querySelector('.form-error');
  if (errorEl) errorEl.remove();
}

/* ==========================================================================
   Image Lazy Loading
   ========================================================================== */
if ('loading' in HTMLImageElement.prototype) {
  // Native lazy loading supported
  document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
    img.loading = 'lazy';
  });
} else {
  // Fallback for older browsers
  const lazyImages = document.querySelectorAll('img[data-src]');
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        imageObserver.unobserve(img);
      }
    });
  });

  lazyImages.forEach((img) => imageObserver.observe(img));
}