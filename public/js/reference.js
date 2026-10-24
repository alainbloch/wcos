/** Native replacements for the original WordPress interaction plugins. */
const menuToggle = document.querySelector(".hfe-nav-menu__toggle");
const navigation = document.querySelector(".hfe-nav-menu__layout-horizontal");
function toggleMenu() {
  const open = navigation?.classList.toggle("mobile-open");
  menuToggle?.setAttribute("aria-expanded", String(Boolean(open)));
}
menuToggle?.addEventListener("click", toggleMenu);
menuToggle?.addEventListener("keydown", (event) => {
  if (["Enter", " "].includes(event.key)) {
    event.preventDefault();
    toggleMenu();
  }
});
for (const toggle of document.querySelectorAll(".hfe-has-submenu-container")) {
  const act = () => {
    const open = toggle.parentElement.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector("a")?.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", (event) => {
    // A nested item such as Rules remains a real link; its arrow opens the submenu.
    const link = toggle.querySelector("a");
    if (
      link?.getAttribute("href") &&
      link.getAttribute("href") !== "#" &&
      !event.target.closest(".sub-arrow")
    )
      return;
    event.preventDefault();
    act();
  });
  toggle.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      act();
    }
  });
}
function closeMenus() {
  document
    .querySelectorAll(".menu-open")
    .forEach((el) => el.classList.remove("menu-open"));
  document
    .querySelectorAll('.hfe-has-submenu-container[aria-expanded="true"]')
    .forEach((el) => el.setAttribute("aria-expanded", "false"));
  navigation?.classList.remove("mobile-open");
  menuToggle?.setAttribute("aria-expanded", "false");
}
document.addEventListener("click", (event) => {
  if (!event.target.closest('[data-elementor-type="header"]')) closeMenus();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenus();
});

const lightbox = document.querySelector(".image-lightbox");
document
  .querySelectorAll('a[data-elementor-open-lightbox="yes"]')
  .forEach((link) =>
    link.addEventListener("click", (event) => {
      if (!lightbox || !/\.(png|jpe?g|webp|gif)$/i.test(link.pathname)) return;
      event.preventDefault();
      const image = lightbox.querySelector("img");
      image.src = link.href;
      image.alt =
        link.querySelector("[aria-label]")?.getAttribute("aria-label") ||
        link.querySelector("img")?.alt ||
        "Equipment photograph";
      lightbox.showModal();
    }),
  );
document.querySelectorAll("[data-member-dialog]").forEach((link) =>
  link.addEventListener("click", (event) => {
    const dialog = document.getElementById(link.dataset.memberDialog);
    if (dialog) {
      event.preventDefault();
      dialog.showModal();
    }
  }),
);
document.querySelectorAll("dialog").forEach((dialog) => {
  dialog
    .querySelector(".dialog-close")
    ?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dialog.close();
    }
  });
});
// Native details support anchors inside previously collapsed glossary/rank sections.
function revealAnchor() {
  if (!location.hash) return;
  let id;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const target = document.getElementById(id);
  if (!target) return;
  for (let el = target.parentElement; el; el = el.parentElement)
    if (el.tagName === "DETAILS") el.open = true;
}
window.addEventListener("hashchange", revealAnchor);
revealAnchor();

const contact = document.querySelector("[data-contact-form]");
contact?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = contact.querySelector('button[type="submit"]');
  const status = contact.querySelector(".contact-status");
  button.disabled = true;
  status.textContent = "Sending…";
  try {
    const response = await fetch(contact.action, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(new FormData(contact)),
    });
    const result = await response.json();
    status.textContent =
      result.message || result.error || "Unable to send your message.";
    if (response.ok) contact.reset();
  } catch {
    status.textContent =
      "Could not connect. Please email westerncouncil@gmail.com directly.";
  } finally {
    button.disabled = false;
  }
});
