// Normal links work without JavaScript; Load More progressively appends records.
document.addEventListener("click", async (event) => {
  const link = event.target.closest("[data-view-more]");
  if (!link) return;
  event.preventDefault();
  if (link.dataset.loading) return;
  link.dataset.loading = "true";
  try {
    const response = await fetch(link.href);
    if (!response.ok) throw new Error("Unable to load records.");
    const doc = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );
    const current = link.closest("[data-view-component]");
    const next = [...doc.querySelectorAll("[data-view-component]")].find(
      (el) => el.dataset.viewComponent === current.dataset.viewComponent,
    );
    if (!next) throw new Error("View unavailable.");
    current
      .querySelector(".data-view-records")
      .append(...next.querySelector(".data-view-records").children);
    current
      .querySelector(".data-view-pagination")
      .replaceWith(
        next.querySelector(".data-view-pagination") ||
          document.createElement("span"),
      );
  } catch {
    link.textContent = "Retry Load More";
    delete link.dataset.loading;
  }
});
