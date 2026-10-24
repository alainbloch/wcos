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
// CMS authors provide inert <template> content; a single dialog displays any of it.
const pageModal = document.getElementById("page-modal");
const modalContent = pageModal?.querySelector("[data-modal-content]");
let modalTrigger;
function openPageModal(event) {
  const trigger = event.target.closest("[data-modal-target]");
  if (!trigger || !pageModal || !modalContent || pageModal.open) return;
  if (
    event.type === "keydown" &&
    (event.target !== trigger || !["Enter", " "].includes(event.key))
  )
    return;
  // Links and form controls inside a clickable row keep their own behavior.
  const control = event.target.closest("a, button, input, select, textarea");
  if (control && control !== trigger) return;
  const source = document.getElementById(trigger.dataset.modalTarget);
  if (!(source instanceof HTMLTemplateElement)) return;
  event.preventDefault();
  modalContent.replaceChildren(source.content.cloneNode(true));
  const profile = source.dataset.modalVariant === "profile";
  pageModal.classList.toggle("profile-modal", profile);
  pageModal.classList.toggle("member-dialog", profile);
  const heading = modalContent.querySelector("[data-modal-title], h1, h2, h3");
  pageModal.removeAttribute("aria-labelledby");
  if (heading) {
    heading.id = "page-modal-title";
    pageModal.setAttribute("aria-labelledby", heading.id);
  }
  pageModal.setAttribute(
    "aria-label",
    source.getAttribute("aria-label") || "Details",
  );
  modalTrigger = trigger;
  pageModal.showModal();
  pageModal.scrollTop = 0;
  pageModal.querySelector(".dialog-close").focus();
}
document.addEventListener("click", openPageModal);
document.addEventListener("keydown", openPageModal);
pageModal?.addEventListener("close", () => {
  modalContent.replaceChildren();
  pageModal.removeAttribute("aria-labelledby");
  pageModal.classList.remove("profile-modal", "member-dialog");
  if (modalTrigger?.isConnected) modalTrigger.focus();
  modalTrigger = null;
});

document.querySelectorAll("[data-member-dialog]").forEach((trigger) => {
  const openProfile = (event) => {
    const dialog = document.getElementById(trigger.dataset.memberDialog);
    if (!dialog || dialog.open) return;
    event.preventDefault();
    dialog.showModal();
    dialog.scrollTop = 0;
    // Return focus to the initiating member, including after Escape/backdrop close.
    dialog.addEventListener("close", () => trigger.focus(), { once: true });
  };
  trigger.addEventListener("click", openProfile);
  trigger.addEventListener("keydown", (event) => {
    if (event.target === trigger && ["Enter", " "].includes(event.key))
      openProfile(event);
  });
});
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
