const cssForm = document.querySelector("[data-layout-css]");
if (cssForm) {
  const source = cssForm.querySelector("textarea");
  const status = cssForm.querySelector("[data-css-status]");
  let version = 0;
  source.addEventListener("input", () => {
    version++;
    cssForm.querySelector("[data-save-status]").textContent = "Unsaved changes";
  });
  cssForm
    .querySelector("[data-css-preview]")
    .addEventListener("click", async () => {
      const current = ++version;
      status.textContent = "Loading preview…";
      try {
        const response = await fetch(cssForm.dataset.previewUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: source.value,
            _csrf: cssForm.elements._csrf.value,
          }),
        });
        const html = await response.text();
        if (!response.ok) throw new Error(html);
        if (current !== version) return;
        const frame = cssForm.querySelector("iframe");
        frame.srcdoc = html;
        frame.hidden = false;
        status.textContent = "Preview only. Save to publish.";
      } catch (error) {
        if (current === version) status.textContent = error.message;
      }
    });
}
