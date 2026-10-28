(() => {
  const form = document.querySelector("[data-page-editor]"),
    frame = document.querySelector("[data-live-preview]"),
    status = document.querySelector("[data-live-status]");
  if (!form || !frame) return;
  let timer,
    version = 0,
    query = {};
  async function preview() {
    const current = ++version,
      values = new FormData(form);
    const body = Object.fromEntries(values);
    body.id = form.dataset.pageId;
    body.dataSources = values.getAll("dataSources");
    // Relationship fields post as arrays; FormData collapses multi-select to one value.
    form
      .querySelectorAll("select[multiple]")
      .forEach((select) => (body[select.name] = values.getAll(select.name)));
    body.query = query;
    // The visual editor holds source content, while this separate preview is read-only.
    const editor = form
      .querySelector("iframe")
      ?.contentDocument?.querySelector("#editable-content");
    if (editor && !form.querySelector("[data-visual-panel]").hidden)
      body.content = editor.innerHTML;
    try {
      const response = await fetch(form.dataset.previewUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const html = await response.text();
      if (current !== version) return;
      if (!response.ok) throw new Error(html);
      frame.onload = () => {
        const doc = frame.contentDocument;
        doc.addEventListener("click", (event) => {
          const link = event.target.closest("a");
          if (!link) return;
          event.preventDefault();
          if (
            link.closest("[data-view-component]") &&
            link.getAttribute("href")?.startsWith("?")
          ) {
            query = Object.fromEntries(
              new URLSearchParams(link.getAttribute("href").slice(1)),
            );
            preview();
          }
        });
        doc.addEventListener("submit", (event) => {
          event.preventDefault();
          query = Object.fromEntries(new FormData(event.target));
          preview();
        });
      };
      frame.srcdoc = html;
      status.textContent = "Preview updated. Changes are not published.";
    } catch (error) {
      if (current === version) status.textContent = error.message;
    }
  }
  function schedule() {
    ++version;
    clearTimeout(timer);
    query = {};
    timer = setTimeout(preview, 300);
  }
  form.addEventListener("input", schedule);
  form.addEventListener("change", schedule);
  form
    .querySelector("iframe")
    ?.addEventListener("load", () =>
      form
        .querySelector("iframe")
        .contentDocument.addEventListener("input", schedule),
    );
  preview();
})();
