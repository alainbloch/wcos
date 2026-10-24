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

it.each(['#123456', '#abc', '', 'invalid'])('synchronizes picker and hex without overwriting initial %s', initial => {
  const dom = new JSDOM(`<form><fieldset data-dalmater-fields><select name="dalmaterMode"><option value="custom">Custom</option></select><div data-dalmater-kaiden></div><div data-dalmater-custom><input type="color" data-dalmater-picker value="#000000"><input name="dalmaterColorHex" value="${initial}"></div></fieldset></form>`, { runScripts: 'outside-only' });
  const {window}=dom;
  window.eval(fs.readFileSync('public/js/admin.js','utf8'));
  const picker=window.document.querySelector('[type=color]');
  const hex=window.document.querySelector('[name=dalmaterColorHex]');
  expect(hex.value).toBe(initial);
  expect(picker.value).toBe(initial === '#abc' ? '#aabbcc' : initial === '#123456' ? initial : '#000000');
  hex.value='#def';hex.dispatchEvent(new window.Event('input'));
  expect(picker.value).toBe('#ddeeff');
  hex.value='bad';hex.dispatchEvent(new window.Event('input'));
  expect(picker.value).toBe('#ddeeff');expect(hex.value).toBe('bad');
  picker.value='#abcdef';picker.dispatchEvent(new window.Event('input'));
  expect(hex.value).toBe('#ABCDEF');
  expect(new window.FormData(window.document.querySelector('form')).get('dalmaterColorHex')).toBe('#ABCDEF');
  dom.window.close();
});
