import { it, expect } from "@jest/globals";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { sanitizePageContent } from "../../src/services/referenceSiteService.js";
const script = fs.readFileSync("public/js/reference.js", "utf8");
function setup() {
  const dom = new JSDOM(
    `<button data-modal-target="first">First</button>
    <div tabindex="0" role="button" data-modal-target="second"><span>Second</span></div>
    <template id="first"><h2>First title</h2><p>First content</p></template>
    <template id="second" data-modal-variant="profile"><h2>Second title</h2><p>Second content</p></template>
    <dialog id="page-modal"><button class="dialog-close">Close</button><div data-modal-content></div></dialog>`,
    { runScripts: "outside-only", url: "http://localhost/" },
  );
  const { window } = dom;
  const dialog = window.document.querySelector("dialog");
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatchEvent(new window.Event("close"));
  };
  window.eval(script);
  return { dom, window, dialog };
}
it.each(["click", "Enter", " "])(
  "opens the matching template through %s and restores focus",
  (action) => {
    const { dom, window, dialog } = setup();
    const trigger = window.document.querySelector(
      '[data-modal-target="second"]',
    );
    expect(dialog.open).toBe(false);
    if (action === "click") trigger.querySelector("span").click();
    else
      trigger.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: action,
          bubbles: true,
          cancelable: true,
        }),
      );
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("Second content");
    expect(dialog.textContent).not.toContain("First content");
    expect(dialog.classList.contains("profile-modal")).toBe(true);
    expect(dialog.getAttribute("aria-labelledby")).toBe("page-modal-title");
    expect(window.document.activeElement).toBe(dialog.querySelector("button"));
    dialog.querySelector("button").click();
    expect(dialog.open).toBe(false);
    expect(window.document.activeElement).toBe(trigger);
    expect(dialog.querySelector("[data-modal-content]").children.length).toBe(
      0,
    );
    window.document.querySelector('[data-modal-target="first"]').click();
    expect(dialog.textContent).toContain("First content");
    expect(dialog.classList.contains("profile-modal")).toBe(false);
    dom.window.close();
  },
);
it("handles backdrop and native Escape-close cleanup, and dynamically added triggers", () => {
  const { dom, window, dialog } = setup();
  const trigger = window.document.createElement("button");
  trigger.dataset.modalTarget = "first";
  window.document.body.append(trigger);
  trigger.click();
  dialog.dispatchEvent(
    new window.MouseEvent("click", { clientX: 20, clientY: 20 }),
  );
  expect(dialog.open).toBe(false);
  trigger.click();
  // Browsers implement Escape by closing the native dialog; simulate its close event.
  dialog.close();
  expect(window.document.activeElement).toBe(trigger);
  trigger.dataset.modalTarget = "page-modal";
  trigger.click();
  expect(dialog.open).toBe(false);
  trigger.dataset.modalTarget = "missing";
  trigger.click();
  expect(dialog.open).toBe(false);
  dom.window.close();
});
it("preserves modal markup through sanitization while removing executable content", () => {
  const html = sanitizePageContent(
    '<button data-modal-target="x">Open</button><template id="x" data-modal-variant="profile"><h2>Title</h2><script>bad()</script><img src="/image.jpg" onerror="bad()"><a href="javascript:bad()">Bad</a></template>',
  );
  expect(html).toContain('<template id="x"');
  expect(html).toContain('data-modal-target="x"');
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onerror");
  expect(html).not.toContain("javascript:");
});
