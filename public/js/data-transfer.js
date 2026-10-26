const form = document.querySelector("[data-transfer-upload]");
if (form)
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-transfer-status]"),
      button = form.querySelector("button");
    const file = form.elements.file.files[0],
      format = file?.name.split(".").pop().toLowerCase();
    if (!file || !["json", "zip"].includes(format)) {
      status.textContent = "Choose a JSON or ZIP backup.";
      return;
    }
    if (file.size > 128 * 1024 * 1024) {
      status.textContent = "The file exceeds 128 MiB.";
      return;
    }
    button.disabled = true;
    status.textContent =
      "Uploading and validating. No database changes are being made…";
    try {
      const response = await fetch("/admin/settings/data-transfer/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-transfer-format": format,
          "x-transfer-mode": form.elements.mode.value,
          "x-transfer-csrf": form.elements._csrf.value,
        },
        body: file,
      });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const message = await response.text();
        throw new Error(
          contentType.includes("text/plain") && message.trim()
            ? message
            : "Upload failed. Reload this page, sign in if needed, and try again.",
        );
      }
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message || result.error || "Upload failed.",
        );
      window.location.assign(result.location);
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });

const exportForm = document.querySelector("[data-transfer-export]");
if (exportForm) {
  const boxes = [...exportForm.querySelectorAll('[name="collections"]')];
  const status = exportForm.querySelector('[data-export-status]');
  exportForm.querySelectorAll('[data-export-select]').forEach(button => {
    button.addEventListener('click', () => {
      boxes.forEach(box => { box.checked = button.dataset.exportSelect === 'all'; });
      status.textContent = '';
    });
  });
  exportForm.addEventListener('submit', event => {
    if (!boxes.some(box => box.checked)) {
      event.preventDefault();
      status.textContent = 'Select at least one collection to export.';
      boxes[0]?.focus();
    } else status.textContent = '';
  });
}
