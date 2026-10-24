import { it, expect } from "@jest/globals";
import fs from "node:fs";
import { JSDOM } from "jsdom";
it("switches color-source controls without losing entered custom values", () => {
  const dom = new JSDOM(
    '<fieldset data-dalmater-fields><select name="dalmaterMode"><option value="">None</option><option value="kaiden">Kaiden</option><option value="custom">Custom</option></select><div data-dalmater-kaiden></div><div data-dalmater-custom><input name="dalmaterColorName" value="Jade"></div></fieldset>',
    { runScripts: "outside-only", url: "http://localhost/admin/members/new" },
  );
  const { window } = dom;
  window.eval(fs.readFileSync("public/js/admin.js", "utf8"));
  const select = window.document.querySelector("select");
  const kaiden = window.document.querySelector("[data-dalmater-kaiden]");
  const custom = window.document.querySelector("[data-dalmater-custom]");
  expect(kaiden.hidden).toBe(true);
  expect(custom.hidden).toBe(true);
  select.value = "kaiden";
  select.dispatchEvent(new window.Event("change"));
  expect(kaiden.hidden).toBe(false);
  expect(custom.hidden).toBe(true);
  select.value = "custom";
  select.dispatchEvent(new window.Event("change"));
  expect(kaiden.hidden).toBe(true);
  expect(custom.hidden).toBe(false);
  expect(custom.querySelector("input").value).toBe("Jade");
  dom.window.close();
});
