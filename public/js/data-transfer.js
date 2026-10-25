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
