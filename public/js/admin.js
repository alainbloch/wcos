/**
 * WCoS Admin JavaScript
 * Handles admin panel interactions, rich text editor, form validation
 */

document.addEventListener("DOMContentLoaded", () => {
  initSidebarToggle();
  initPageEditor();
  initTableFilters();
  initFormValidation();
  initConfirmDelete();
  initTableSorting();
  initFlashDismiss();
});

/* ==========================================================================
   Sidebar Toggle (Mobile)
   ========================================================================== */
function initSidebarToggle() {
  const toggle = document.createElement("button");
  toggle.className = "admin-sidebar-toggle";
  toggle.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  `;
  toggle.setAttribute("aria-label", "Toggle sidebar");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "admin-sidebar");

  const header = document.querySelector(".admin-header");
  if (header) {
    header.insertBefore(toggle, header.firstChild);
  }

  const sidebar = document.querySelector(".admin-sidebar");
  const overlay = document.createElement("div");
  overlay.className = "admin-overlay";
  document.body.appendChild(overlay);

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", !expanded);
    sidebar.classList.toggle("open");
    overlay.classList.toggle("open");
  });

  function closeSidebar() {
    toggle.setAttribute("aria-expanded", "false");
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  }
  overlay.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebar();
      toggle.focus();
    }
  });
  const mobile = window.matchMedia("(max-width: 800px)");
  function updateSidebar() {
    sidebar.inert = mobile.matches && !sidebar.classList.contains("open");
  }
  toggle.addEventListener("click", updateSidebar);
  overlay.addEventListener("click", updateSidebar);
  document.addEventListener("keydown", updateSidebar);
  mobile.addEventListener("change", () => {
    closeSidebar();
    updateSidebar();
  });
  updateSidebar();
}

/* ==========================================================================
   Rich Text Editor (Simple)
   ========================================================================== */
function initPageEditor() {
  const form = document.querySelector("[data-page-editor]");
  if (!form) return;
  // One textarea is the only submitted content field, including without JavaScript.
  const source = form.querySelector('textarea[name="content"]');
  const frame = form.querySelector("iframe");
  const panel = form.querySelector("[data-visual-panel]");
  const status = form.querySelector("[data-editor-status]");
  const saveStatus = form.querySelector("[data-save-status]");
  let dirty = form.dataset.unsaved === "true";
  let visualChanged = false;
  let editable;
  let requestVersion = 0;
  function markDirty() {
    dirty = true;
    saveStatus.textContent = "Unsaved changes";
  }
  function syncVisual() {
    // Do not reserialize untouched imported markup: it may contain significant layout attributes.
    if (visualChanged && editable) source.value = editable.innerHTML;
    visualChanged = false;
  }
  function showMode(mode) {
    panel.hidden = mode !== "visual";
    source.hidden = mode === "visual";
    form.querySelector("[data-source-label]").hidden = source.hidden;
    form
      .querySelectorAll("[data-editor-mode]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.editorMode === mode),
        ),
      );
  }
  async function openVisual() {
    const version = ++requestVersion;
    const contentAtRequest = source.value;
    status.textContent = "Loading visual editor…";
    try {
      const response = await fetch("/admin/pages/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.dataset.pageId,
          content: contentAtRequest,
        }),
      });
      if (!response.ok) throw new Error("Preview unavailable");
      const html = await response.text();
      // A slow preview must never replace typing or a newer mode selection.
      if (version !== requestVersion || contentAtRequest !== source.value)
        return;
      frame.onload = () => {
        if (version !== requestVersion) return;
        editable = frame.contentDocument.querySelector("#editable-content");
        if (!editable) return;
        editable.contentEditable = "true";
        editable.setAttribute("role", "textbox");
        editable.setAttribute("aria-label", "Page content");
        editable.setAttribute("aria-multiline", "true");
        visualChanged = false;
        editable.addEventListener("input", () => {
          visualChanged = true;
          markDirty();
        });
        // Keep editing clicks from following links or submitting embedded public forms.
        frame.contentDocument.addEventListener("click", (event) => {
          if (event.target.closest("a,button,input,select"))
            event.preventDefault();
        });
        frame.contentDocument.addEventListener("submit", (event) =>
          event.preventDefault(),
        );
        status.textContent =
          "Click in the page to edit text. Layout changes are available in HTML source.";
        showMode("visual");
      };
      frame.srcdoc = html;
    } catch {
      if (version === requestVersion) {
        showMode("source");
        status.textContent =
          "Visual editor could not load. Your content is safe; edit HTML below or retry Visual editor.";
      }
    }
  }
  form.querySelectorAll("[data-editor-mode]").forEach((button) =>
    button.addEventListener("click", () => {
      syncVisual();
      if (button.dataset.editorMode === "visual") openVisual();
      else {
        ++requestVersion;
        showMode("source");
        status.textContent = "Editing HTML source. Changes are not saved yet.";
      }
    }),
  );
  form.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      if (!editable) return;
      editable.focus();
      const command = button.dataset.command;
      let value = null;
      if (command === "createLink") {
        value = prompt("Link address (https://…, mailto:…, or /page):");
        if (!value || !/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(value))
          return;
      }
      frame.contentDocument.execCommand(
        ["h2", "p"].includes(command) ? "formatBlock" : command,
        false,
        ["h2", "p"].includes(command) ? command : value,
      );
      visualChanged = true;
      markDirty();
    });
  });
  form.addEventListener("input", markDirty);
  form.addEventListener("submit", (event) => {
    syncVisual();
    if (!event.defaultPrevented) dirty = false;
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  openVisual();
}

function initTableFilters() {
  document.querySelectorAll("[data-table-filter]").forEach((container) => {
    const search = container.querySelector("[data-search]");
    const status = container.querySelector("[data-status]");
    const rows = [...container.querySelectorAll("tbody tr")];
    const counter = container.querySelector("[data-result-count]");
    function filter() {
      const query = search.value.trim().toLocaleLowerCase();
      let count = 0;
      rows.forEach((row) => {
        row.hidden =
          !row.textContent.toLocaleLowerCase().includes(query) ||
          Boolean(status?.value && row.dataset.status !== status.value);
        if (!row.hidden) count++;
      });
      counter.textContent = `${count} of ${rows.length} shown`;
      container.querySelector("[data-no-results]").hidden = count > 0;
    }
    search.addEventListener("input", filter);
    status?.addEventListener("change", filter);
    filter();
  });
}

/* ==========================================================================
   Form Validation
   ========================================================================== */
function initFormValidation() {
  document.querySelectorAll("form[data-validate]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      if (!validateForm(form)) {
        e.preventDefault();
      }
    });

    // Real-time validation
    form.querySelectorAll("input, select, textarea").forEach((field) => {
      field.addEventListener("blur", () => validateField(field));
      field.addEventListener("input", () => {
        if (field.classList.contains("error")) {
          validateField(field);
        }
      });
    });
  });
}

function validateForm(form) {
  let valid = true;
  const fields = form.querySelectorAll("[required]");

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
    showFieldError(field, "This field is required");
    return false;
  }

  if (field.type === "email" && field.value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(field.value)) {
      showFieldError(field, "Please enter a valid email address");
      return false;
    }
  }

  if (field.type === "url" && field.value) {
    try {
      new URL(field.value);
    } catch {
      showFieldError(field, "Please enter a valid URL");
      return false;
    }
  }

  if (
    field.dataset.minlength &&
    field.value.length < parseInt(field.dataset.minlength, 10)
  ) {
    showFieldError(
      field,
      `Must be at least ${field.dataset.minlength} characters`,
    );
    return false;
  }

  if (
    field.dataset.maxlength &&
    field.value.length > parseInt(field.dataset.maxlength, 10)
  ) {
    showFieldError(
      field,
      `Must be no more than ${field.dataset.maxlength} characters`,
    );
    return false;
  }

  return true;
}

function showFieldError(field, message) {
  field.classList.add("error");
  const errorEl = document.createElement("div");
  errorEl.className = "form-error";
  errorEl.textContent = message;
  field.parentNode.appendChild(errorEl);
}

function clearFieldError(field) {
  field.classList.remove("error");
  const errorEl = field.parentNode.querySelector(".form-error");
  if (errorEl) errorEl.remove();
}

/* ==========================================================================
   Confirm Delete
   ========================================================================== */
function initConfirmDelete() {
  document.querySelectorAll("[data-confirm-delete]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const message =
        btn.dataset.confirmDelete ||
        "Are you sure you want to delete this item?";
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
  document.querySelectorAll(".admin-table th[data-sort]").forEach((th) => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const table = th.closest(".admin-table");
      const tbody = table.querySelector("tbody");
      const columnIndex = Array.from(th.parentNode.children).indexOf(th);
      const isAsc = th.classList.toggle("sort-asc");
      th.classList.toggle("sort-desc", !isAsc);

      // Remove sort classes from other headers
      table.querySelectorAll("th[data-sort]").forEach((otherTh) => {
        if (otherTh !== th) {
          otherTh.classList.remove("sort-asc", "sort-desc");
        }
      });

      const rows = Array.from(tbody.querySelectorAll("tr"));
      rows.sort((a, b) => {
        const aText = a.children[columnIndex].textContent.trim();
        const bText = b.children[columnIndex].textContent.trim();
        return isAsc
          ? aText.localeCompare(bText, undefined, { numeric: true })
          : bText.localeCompare(aText, undefined, { numeric: true });
      });

      rows.forEach((row) => tbody.appendChild(row));
    });
  });
}

/* ==========================================================================
   Flash Message Auto-dismiss
   ========================================================================== */
function initFlashDismiss() {
  document.querySelectorAll(".alert").forEach((alert) => {
    const dismissBtn = document.createElement("button");
    dismissBtn.className = "alert-dismiss";
    dismissBtn.innerHTML = "&times;";
    dismissBtn.setAttribute("aria-label", "Dismiss");
    dismissBtn.addEventListener("click", () => {
      alert.style.opacity = "0";
      alert.style.transform = "translateX(20px)";
      setTimeout(() => alert.remove(), 300);
    });
    alert.appendChild(dismissBtn);
  });
}

/* ==========================================================================
   Slug Generation
   ========================================================================== */
function initSlugGeneration() {
  const titleInput = document.querySelector('input[name="title"]');
  const slugInput = document.querySelector('input[name="slug"]');

  if (titleInput && slugInput) {
    titleInput.addEventListener(
      "input",
      debounce(() => {
        if (!slugInput.dataset.manuallyEdited) {
          slugInput.value = generateSlug(titleInput.value);
        }
      }, 300),
    );

    slugInput.addEventListener("input", () => {
      slugInput.dataset.manuallyEdited = "true";
    });
  }
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  document.querySelectorAll("[data-dynamic-fields]").forEach((container) => {
    const template = container.querySelector("[data-field-template]");
    const addBtn = container.querySelector("[data-add-field]");

    if (!template || !addBtn) return;

    addBtn.addEventListener("click", () => {
      const clone = template.content.cloneNode(true);
      const input = clone.querySelector("input, select, textarea");
      if (input) {
        input.name = input.name.replace("__INDEX__", Date.now());
        input.value = "";
      }
      container.insertBefore(clone, addBtn);
    });

    container.addEventListener("click", (e) => {
      if (e.target.matches("[data-remove-field]")) {
        e.target.closest("[data-field-item]").remove();
      }
    });
  });
}

// Initialize dynamic fields
document.addEventListener("DOMContentLoaded", initDynamicFields);
initSlugGeneration();

/* ==========================================================================
   Image Preview
   ========================================================================== */
function initImagePreview() {
  document
    .querySelectorAll('input[type="file"][accept*="image"]')
    .forEach((input) => {
      input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const preview = document.createElement("img");
        preview.className = "image-preview";
        preview.style.maxWidth = "200px";
        preview.style.marginTop = "var(--space-3)";
        preview.style.borderRadius = "var(--radius-md)";

        const reader = new FileReader();
        reader.onload = (e) => {
          preview.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // Remove existing preview
        const existing = input.parentNode.querySelector(".image-preview");
        if (existing) existing.remove();

        input.parentNode.appendChild(preview);
      });
    });
}

initImagePreview();

// Keep both values available when switching modes; the server validates only the chosen source.
document.querySelectorAll('[data-dalmater-fields]').forEach(section => {
  const mode = section.querySelector('[name="dalmaterMode"]');
  const update = () => {
    section.querySelector('[data-dalmater-kaiden]').hidden = mode.value !== 'kaiden';
    section.querySelector('[data-dalmater-custom]').hidden = mode.value !== 'custom';
  };
  mode.addEventListener('change', update);
  update();
});
