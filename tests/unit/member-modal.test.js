import { describe, it, expect } from "@jest/globals";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { memberProfileService } from "../../src/services/memberProfileService.js";

const script = fs.readFileSync("public/js/reference.js", "utf8");
describe("Member profiles and modal interaction", () => {
  it("retains the original Gad biography and historical statistics", () => {
    const profile = memberProfileService.profiles([
      { position: "Gad", level: "L7" },
    ])[0];
    expect(profile.biographyHtml).toContain("original martial artists");
    expect(profile.image).toBe("/images/gad.jpg");
    expect(
      profile.stats.find((item) => item.label === "Battles Fought").value,
    ).toContain("10,000");
    expect(profile.email).toBe("gad@westerncircle.org");
  });
  it("assigns unique dialogs to members sharing a circle name", () => {
    const profiles = memberProfileService.profiles([
      { id: "one", position: "Gad" },
      { id: "two", position: "Gad" },
    ]);
    expect(new Set(profiles.map((profile) => profile.dialogId)).size).toBe(2);
  });
  it("uses saved profile details and sanitizes biography Markdown", () => {
    const profile = memberProfileService.profiles([
      {
        position: "Test member",
        level: "L3",
        steelRank: "L2",
        biography: "**A swordsman**\n\n<script>bad()</script>",
        yearsFought: "12",
        weaponType: "Longsword",
        email: "invalid<script>",
      },
    ])[0];
    expect(profile.biographyHtml).toContain("<strong>A swordsman</strong>");
    expect(profile.biographyHtml).not.toContain("<script>");
    expect(
      profile.stats.find((item) => item.label === "Years Fought").value,
    ).toBe("12");
    expect(profile.email).toBe("");
    expect(
      memberProfileService.profiles([{ position: "Unknown" }])[0].biographyHtml,
    ).toBe("");
  });
  it.each(["click", "Enter", " "])(
    "opens the correct profile through %s and restores focus on close",
    (action) => {
      const dom = new JSDOM(
        '<div tabindex="0" role="button" data-member-dialog="first">First member</div><div tabindex="0" role="button" data-member-dialog="second">Second member</div><dialog id="first"><button class="dialog-close">Close</button></dialog><dialog id="second"><button class="dialog-close">Close</button></dialog>',
        { runScripts: "outside-only", url: "http://localhost/member-profiles" },
      );
      const { window } = dom;
      for (const dialog of window.document.querySelectorAll("dialog")) {
        dialog.showModal = () => {
          dialog.open = true;
        };
        dialog.close = () => {
          dialog.open = false;
          dialog.dispatchEvent(new window.Event("close"));
        };
      }
      window.eval(script);
      const trigger = window.document.querySelector(
        "[data-member-dialog=second]",
      );
      if (action === "click") trigger.click();
      else
        trigger.dispatchEvent(
          new window.KeyboardEvent("keydown", {
            key: action,
            bubbles: true,
            cancelable: true,
          }),
        );
      const dialog = window.document.getElementById("second");
      expect(dialog.open).toBe(true);
      expect(window.document.getElementById("first").open).toBe(false);
      dialog.querySelector("button").click();
      expect(dialog.open).toBe(false);
      expect(window.document.activeElement).toBe(trigger);
      trigger.click();
      dialog.dispatchEvent(
        new window.MouseEvent("click", { clientX: 20, clientY: 20 }),
      );
      expect(dialog.open).toBe(false);
      dom.window.close();
    },
  );
});
