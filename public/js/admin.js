/**
 * WCoS Admin JavaScript
 * Handles admin panel interactions, rich text editor, form validation
 */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initRichEditor();
  initFormValidation();
  initConfirmDelete();
  initTableSorting();
  initFlashDismiss();
});

/* ==========================================================================
   Sidebar Toggle (Mobile)
   ========================================================================== */
function initSidebarToggle() {
  const toggle = document.createElement('button');
  toggle.className = 'admin-sidebar-toggle';
  toggle.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  `;
  toggle.setAttribute('aria-label', 'Toggle sidebar');
  toggle.setAttribute('aria-expanded', 'false');

  const header = document.querySelector('.admin-header');
  if (header) {
    header.insertBefore(toggle, header.firstChild);
  }

  const sidebar = document.querySelector('.admin-sidebar');
  const overlay = document.createElement('div');
  overlay.className = 'admin-overlay';
  document.body.appendChild(overlay);

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', !expanded);
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });

  overlay.addEventListener('click', () => {
    toggle.setAttribute('aria-expanded', 'false');
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

/* ==========================================================================
   Rich Text Editor (Simple)
   ========================================================================== */
function initRichEditor() {
  document.querySelectorAll('.rich-editor').forEach((editor) => {
    const toolbar = editor.querySelector('.editor-toolbar');
    const content = editor.querySelector('.editor-content');
    const hiddenInput = editor.querySelector('textarea[name="content"]') || createHiddenInput(editor);

    if (!toolbar || !content) return;

    // Toolbar buttons
    toolbar.querySelectorAll('.editor-btn[data-format]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const format = btn.dataset.format;
        applyFormat(format, content);
        btn.classList.toggle('active');
      });
    });

    // Link button
    const linkBtn = toolbar.querySelector('.editor-btn[data-format="link"]');
    if (linkBtn) {
      linkBtn.addEventListener('click', () => {
        const url = prompt('Enter URL:');
        if (url) {
          document.execCommand('createLink', false, url);
        }
      });
    }

    // Sync content to hidden input on blur
    content.addEventListener('blur', () => {
      hiddenInput.value = content.innerHTML;
    });

    // Initialize with existing content
    if (hiddenInput.value) {
      content.innerHTML = hiddenInput.value;
    }
  });
}

function createHiddenInput(editor) {
  const form = editor.closest('form');
  if (!form) return null;

  const hiddenInput = document.createElement('textarea');
  hiddenInput.name = 'content';
  hiddenInput.style.display = 'none';
  form.appendChild(hiddenInput);
  return hiddenInput;
}

function applyFormat(format, content) {
  content.focus();
  switch (format) {
    case 'bold':
      document.execCommand('bold');
      break;
    case 'italic':
      document.execCommand('italic');
      break;
    case 'underline':
      document.execCommand('underline');
      break;
    case 'strike':
      document.execCommand('strikeThrough');
      break;
    case 'ul':
      document.execCommand('insertUnorderedList');
      break;
    case 'ol':
      document.execCommand('insertOrderedList');
      break;
    case 'h2':
      document.execCommand('formatBlock', false, 'h2');
      break;
    case 'h3':
      document.execCommand('formatBlock', false, 'h3');
      break;
    case 'p':
      document.execCommand('formatBlock', false, 'p');
      break;
    case 'code':
      document.execCommand('formatBlock', false, 'pre');
      break;
    case 'blockquote':
      document.execCommand('formatBlock', false, 'blockquote');
      break;
    case 'removeFormat':
      document.execCommand('removeFormat');
      break;
  }
}

/* ==========================================================================
   Form Validation
   ========================================================================== */
function initFormValidation() {
  document.querySelectorAll('form[data-validate]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (!validateForm(form)) {
        e.preventDefault();
      }
    });

    // Real-time validation
    form.querySelectorAll('input, select, textarea').forEach((field) => {
      field.addEventListener('blur', () => validateField(field));
      field.addEventListener('input', () => {
        if (field.classList.contains('error')) {
          validateField(field);
        }
      });
    });
  });
}

function validateForm(form) {
  let valid = true;
  const fields = form.querySelectorAll('[required]');

  fields.forEach((field) => {
    if (!validateField(field)) {
      valid = false;
    }
  });

  return valid;
}

function validateField(field) {
  clearFieldError(field);

  if (field.required && !field.value.trim()) {
    showFieldError(field, 'This field is required');
    return false;
  }

  if (field.type === 'email' && field.value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(field.value)) {
      showFieldError(field, 'Please enter a valid email address');
      return false;
    }
  }

  if (field.type === 'url' && field.value) {
    try {
      new URL(field.value);
    } catch {
      showFieldError(field, 'Please enter a valid URL');
      return false;
    }
  }

  if (field.dataset.minlength && field.value.length < parseInt(field.dataset.minlength, 10)) {
    showFieldError(field, `Must be at least ${field.dataset.minlength} characters`);
    return false;
  }

  if (field.dataset.maxlength && field.value.length > parseInt(field.dataset.maxlength, 10)) {
    showFieldError(field, `Must be no more than ${field.dataset.maxlength} characters`);
    return false;
  }

  return true;
}

function showFieldError(field, message) {
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
   Confirm Delete
   ========================================================================== */
function initConfirmDelete() {
  document.querySelectorAll('[data-confirm-delete]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const message = btn.dataset.confirmDelete || 'Are you sure you want to delete this item?';
      if (!confirm(message)) {
        e.preventDefault();
      }
    });
  });
}

/* ==========================================================================
   Table Sorting
   ========================================================================== */
function initTableSorting() {
  document.querySelectorAll('.admin-table th[data-sort]').forEach((th) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const table = th.closest('.admin-table');
      const tbody = table.querySelector('tbody');
      const columnIndex = Array.from(th.parentNode.children).indexOf(th);
      const isAsc = th.classList.toggle('sort-asc');
      th.classList.toggle('sort-desc', !isAsc);

      // Remove sort classes from other headers
      table.querySelectorAll('th[data-sort]').forEach((otherTh) => {
        if (otherTh !== th) {
          otherTh.classList.remove('sort-asc', 'sort-desc');
        }
      });

      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.sort((a, b) => {
        const aText = a.children[columnIndex].textContent.trim();
        const bText = b.children[columnIndex].textContent.trim();
        return isAsc ? aText.localeCompare(bText, undefined, { numeric: true }) : bText.localeCompare(aText, undefined, { numeric: true });
      });

      rows.forEach((row) => tbody.appendChild(row));
    });
  });
}

/* ==========================================================================
   Flash Message Auto-dismiss
   ========================================================================== */
function initFlashDismiss() {
  document.querySelectorAll('.alert').forEach((alert) => {
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'alert-dismiss';
    dismissBtn.innerHTML = '&times;';
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.addEventListener('click', () => {
      alert.style.opacity = '0';
      alert.style.transform = 'translateX(20px)';
      setTimeout(() => alert.remove(), 300);
    });
    alert.appendChild(dismissBtn);

    setTimeout(() => {
      if (alert.parentNode) {
        alert.style.opacity = '0';
        alert.style.transform = 'translateX(20px)';
        setTimeout(() => alert.remove(), 300);
      }
    }, 8000);
  });
}

/* ==========================================================================
   Slug Generation
   ========================================================================== */
function initSlugGeneration() {
  const titleInput = document.querySelector('input[name="title"]');
  const slugInput = document.querySelector('input[name="slug"]');

  if (titleInput && slugInput) {
    titleInput.addEventListener('input', debounce(() => {
      if (!slugInput.dataset.manuallyEdited) {
        slugInput.value = generateSlug(titleInput.value);
      }
    }, 300));

    slugInput.addEventListener('input', () => {
      slugInput.dataset.manuallyEdited = 'true';
    });
  }
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
   Dynamic Form Fields
   ========================================================================== */
function initDynamicFields() {
  document.querySelectorAll('[data-dynamic-fields]').forEach((container) => {
    const template = container.querySelector('[data-field-template]');
    const addBtn = container.querySelector('[data-add-field]');

    if (!template || !addBtn) return;

    addBtn.addEventListener('click', () => {
      const clone = template.content.cloneNode(true);
      const input = clone.querySelector('input, select, textarea');
      if (input) {
        input.name = input.name.replace('__INDEX__', Date.now());
        input.value = '';
      }
      container.insertBefore(clone, addBtn);
    });

    container.addEventListener('click', (e) => {
      if (e.target.matches('[data-remove-field]')) {
        e.target.closest('[data-field-item]').remove();
      }
    });
  });
}

// Initialize dynamic fields
document.addEventListener('DOMContentLoaded', initDynamicFields);
initSlugGeneration();

/* ==========================================================================
   Image Preview
   ========================================================================== */
function initImagePreview() {
  document.querySelectorAll('input[type="file"][accept*="image"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const preview = document.createElement('img');
      preview.className = 'image-preview';
      preview.style.maxWidth = '200px';
      preview.style.marginTop = 'var(--space-3)';
      preview.style.borderRadius = 'var(--radius-md)';

      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
      };
      reader.readAsDataURL(file);

      // Remove existing preview
      const existing = input.parentNode.querySelector('.image-preview');
      if (existing) existing.remove();

      input.parentNode.appendChild(preview);
    });
  });
}

initImagePreview();