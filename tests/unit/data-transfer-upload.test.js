import { it, expect } from "@jest/globals";
import fs from "node:fs";
import { JSDOM } from "jsdom";
const script = fs.readFileSync("public/js/data-transfer.js", "utf8");
it.each([
  [
    "text/plain",
    "Invalid form token. Reload the form and try again.",
    "Invalid form token. Reload the form and try again.",
  ],
  [
    "text/html",
    "<html>Bad gateway</html>",
    "Upload failed. Reload this page, sign in if needed, and try again.",
  ],
  ["application/json", { error: "Invalid archive." }, "Invalid archive."],
])(
  "shows a usable error for %s upload responses",
  async (type, body, expected) => {
    const dom = new JSDOM(
      '<form data-transfer-upload><input name="file" type="file"><input name="mode" value="restore"><input name="_csrf" value="token"><button>Upload</button><p data-transfer-status></p></form>',
      { runScripts: "outside-only" },
    );
    const { window } = dom;
    const form = window.document.querySelector("form");
    Object.defineProperty(form.elements.file, "files", {
      value: [new window.File(["backup"], "backup.zip")],
    });
    window.fetch = async () => ({
      ok: false,
      headers: { get: () => type },
      text: async () => body,
      json: async () => body,
    });
    window.eval(script);
    form.dispatchEvent(new window.Event("submit", { cancelable: true }));
    await new Promise((resolve) => setImmediate(resolve));
    expect(form.querySelector("[data-transfer-status]").textContent).toBe(
      expected,
    );
    expect(form.querySelector("button").disabled).toBe(false);
    window.close();
  },
);
