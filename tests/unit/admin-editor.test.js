import { describe, it, expect } from "@jest/globals";
import fs from "node:fs";
import { JSDOM } from "jsdom";
const script = fs.readFileSync("public/js/admin.js", "utf8");
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function setup({ failure = false, pending = false } = {}) {
  const dom = new JSDOM(
    `<form data-page-editor data-page-id="example"><input name="title"><input name="slug" value="existing" data-manually-edited="true"><textarea name="content">&lt;p&gt;Existing content&lt;/p&gt;</textarea><iframe></iframe><div data-visual-panel hidden></div><span data-editor-status></span><span data-save-status></span><label data-source-label></label><button type="button" data-editor-mode="visual"></button><button type="button" data-editor-mode="source"></button></form>`,
    {
      runScripts: "outside-only",
      url: "http://localhost/admin/pages/example/edit",
    },
  );
  const { window } = dom;
  let resolveFetch;
  window.fetch = () =>
    pending
      ? new Promise((resolve) => {
          resolveFetch = resolve;
        })
      : Promise.resolve({
          ok: !failure,
          text: async () => "<main>preview</main>",
        });
  // Initialize only the editor; sidebar and page-list widgets have independent DOMs.
  window.eval(script);
  window.initPageEditor();
  await flush();
  const form = window.document.querySelector("form");
  const frame = form.querySelector("iframe");
  const source = form.querySelector("textarea");
  const loadFrame = () => {
    frame.contentDocument.body.innerHTML =
      '<main id="editable-content"><p>Existing content</p></main>';
    frame.onload();
    return frame.contentDocument.querySelector("main");
  };
  return { dom, window, form, frame, source, loadFrame, resolveFetch };
}
describe("Admin browser editor behavior", () => {
  it("loads a visual editor and submits edits without waiting for blur", async () => {
    const { dom, window, form, source, loadFrame } = await setup();
    const editable = loadFrame();
    expect(editable.contentEditable).toBe("true");
    expect(source.hidden).toBe(true);
    editable.innerHTML = "<h2>Changed in visual mode</h2>";
    editable.dispatchEvent(new window.Event("input"));
    form.dispatchEvent(new window.Event("submit", { cancelable: true }));
    expect(source.value).toBe("<h2>Changed in visual mode</h2>");
    expect(form.querySelectorAll("[name=content]").length).toBe(1);
    dom.window.close();
  });
  it("preserves exact untouched source and existing slugs", async () => {
    const { dom, window, form, source, loadFrame } = await setup();
    const original = '<p data-keep="yes">Original  &amp; spacing</p>';
    source.value = original;
    loadFrame();
    form.dispatchEvent(new window.Event("submit", { cancelable: true }));
    expect(source.value).toBe(original);
    form.querySelector("[name=title]").value = "Different title";
    form.querySelector("[name=title]").dispatchEvent(new window.Event("input"));
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(form.querySelector("[name=slug]").value).toBe("existing");
    dom.window.close();
  });
  it("synchronizes visual content when switching to HTML and warns about unsaved edits", async () => {
    const { dom, window, form, source, loadFrame } = await setup();
    const editable = loadFrame();
    editable.innerHTML = "<p>Keep this edit</p>";
    editable.dispatchEvent(new window.Event("input"));
    form.querySelector("[data-editor-mode=source]").click();
    expect(source.value).toBe("<p>Keep this edit</p>");
    expect(source.hidden).toBe(false);
    const unload = new window.Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    dom.window.close();
  });
  it("leaves content editable when the preview request fails", async () => {
    const { dom, form, source } = await setup({ failure: true });
    expect(source.hidden).toBe(false);
    expect(source.value).toContain("Existing content");
    expect(form.querySelector("[data-editor-status]").textContent).toContain(
      "could not load",
    );
    dom.window.close();
  });
  it("does not let a delayed preview replace newer source typing", async () => {
    const { dom, source, frame, resolveFetch } = await setup({ pending: true });
    source.value = "<p>New typing while waiting</p>";
    resolveFetch({ ok: true, text: async () => "stale preview" });
    await flush();
    expect(source.hidden).toBe(false);
    expect(frame.srcdoc).toBe("");
    expect(source.value).toContain("New typing");
    dom.window.close();
  });
});
