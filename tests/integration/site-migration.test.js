import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import {
  originalPages,
  ensureReferencePages,
  sanitizePageContent,
} from "../../src/services/referenceSiteService.js";
import { pagesRepo, getDatabase } from "../../src/models/database.js";

let app;
beforeAll(async () => {
  app = await buildApp();
  await ensureReferencePages();
  await app.ready();
});
afterAll(async () => app.close());
describe("Complete public conversion", () => {
  it.each(originalPages.map((page) => [page.slug, page]))(
    "renders migrated page /%s with its local styling",
    async (slug, page) => {
      const response = await app.inject("/" + slug);
      expect(response.statusCode).toBe(200);
      const $ = load(response.payload);
      expect($("main [data-elementor-type]").length).toBeGreaterThan(0);
      expect($('link[href="/css/fonts.css"]').length).toBe(1);
      expect($('script[src*="wp-content"]').length).toBe(0);
      expect($("main").text().replace(/\s+/g, " ").length).toBeGreaterThan(15);
      expect($("main").html()).not.toContain("[Truncated]");
      for (const stylesheet of page.styles) {
        expect($(`link[href="${stylesheet}"]`).length).toBeGreaterThan(0);
        expect(
          fs.existsSync(path.join(process.cwd(), "public", stylesheet)),
        ).toBe(true);
      }
    },
  );
  it("ships every referenced local image, font and stylesheet", () => {
    const files = [];
    for (const page of originalPages) {
      files.push(page.content);
      for (const css of page.styles)
        files.push(fs.readFileSync(`public${css}`, "utf8"));
    }
    files.push(fs.readFileSync("public/css/fonts.css", "utf8"));
    const references = new Set(
      files.flatMap((text) =>
        [...text.matchAll(/\/(?:images|fonts|css)\/[^\s"'<>;)]+/g)].map(
          (m) => m[0],
        ),
      ),
    );
    for (const reference of references)
      expect(fs.existsSync(`public${reference}`)).toBe(true);
  });
  it.each([
    ["/contact-us", "/contact"],
    ["/previous-updates", "/updates"],
  ])("preserves legacy alias %s", async (from, to) => {
    const response = await app.inject(from);
    expect(response.statusCode).toBe(301);
    expect(response.headers.location).toBe(to);
  });
  it("keeps the original external photo gallery destination", async () => {
    const response = await app.inject("/photo-gallery");
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      "https://westerncircle.smugmug.com/",
    );
  });
  it("supports WordPress-style trailing slashes", async () =>
    expect((await app.inject("/armor/")).statusCode).toBe(200));
  it("searches the complete page content and escapes the query", async () => {
    const response = await app.inject("/search?q=gorget");
    expect(response.payload).toContain('href="/armor"');
    const unsafe = await app.inject("/search?q=%3Cscript%3E");
    expect(unsafe.payload).not.toContain("<script>");
  });
  it("keeps the old home search URL functional", async () =>
    expect((await app.inject("/?s=armor")).headers.location).toBe(
      "/search?q=armor",
    ));
  it("serves the favicon instead of interpreting it as a CMS slug", async () => {
    const response = await app.inject("/favicon.png");
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("image/png");
  });
  it("preserves CMS edits and publication state across migration runs", async () => {
    const page = await pagesRepo.findBySlug("weapons");
    await pagesRepo.update(page.id, {
      content: "<h1>Updated weapons guide</h1><script>alert(1)</script>",
    });
    await ensureReferencePages();
    expect((await app.inject("/weapons")).payload).toContain(
      "Updated weapons guide",
    );
    expect((await app.inject("/weapons")).payload).not.toContain("alert(1)");
    await pagesRepo.update(page.id, { published: false });
    expect((await app.inject("/weapons")).statusCode).toBe(404);
    await pagesRepo.update(page.id, page);
  });
  it("sanitizes script and handler injection while retaining native accordions", () => {
    const result = sanitizePageContent(
      '<details><summary>Hello</summary><img src="/images/gad.jpg" onerror="alert(1)"><script>alert(2)</script></details>',
    );
    expect(result).toContain("<details>");
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("<script>");
  });
  it("preserves the verified public PayPal hosted-button configuration", () => {
    const $ = load(originalPages.find((page) => page.slug === "dues").content);
    expect($('input[name="hosted_button_id"]').attr("value")).toBe(
      "CK23BQFMGKR3Y",
    );
    expect($('input[name="cmd"]').attr("value")).toBe("_s-xclick");
    expect($("form").attr("action")).toBe(
      "https://www.paypal.com/cgi-bin/webscr",
    );
  });
  it("does not leave any WordPress form submission endpoints", () => {
    for (const page of originalPages) {
      const $ = load(page.content);
      $("form").each((_, form) =>
        expect($(form).attr("action") || "").not.toContain("vead.sg-host.com"),
      );
    }
  });
  it("migrates settings and retires navigation", () => {
    expect(Array.isArray(getDatabase().data.siteSettings)).toBe(true);
    expect(getDatabase().data.navigation).toBeUndefined();
  });
});
