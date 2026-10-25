import { ensureReferencePages } from "../../src/services/referenceSiteService.js";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import { pagesRepo, usersRepo } from "../../src/models/database.js";
import { authService } from "../../src/services/authService.js";

let app, cookie, home;
beforeAll(async () => {
  app = await buildApp();
  await ensureReferencePages();
  await app.ready();
  const admin = await usersRepo.findByEmail("admin@wcos.org");
  cookie = `wcos_session=${authService.generateToken(admin)}`;
  home = await pagesRepo.findBySlug("");
});
afterAll(async () => app.close());
const get = (url) => app.inject({ url, headers: { cookie } });
const post = (url, payload) =>
  app.inject({ method: "POST", url, payload, headers: { cookie } });

describe("Admin editing workflow", () => {
  it("loads every admin screen with the independent admin stylesheet", async () => {
    for (const url of [
      "/admin",
      "/admin/pages",
      "/admin/pages/new",
      "/admin/members",
      "/admin/settings",
      "/admin/members/new",
      "/admin/classes", "/admin/classes/new",
      "/admin/moves", "/admin/moves/new",
      "/admin/glossary", "/admin/glossary/new",
      "/admin/updates", "/admin/updates/new",
      "/admin/users", "/admin/users/new",
      "/admin/layout/header", "/admin/settings/data-transfer",
    ]) {
      const response = await get(url);
      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain("/css/admin.css");
      const $ = load(response.payload);
      expect($("h1").length).toBe(1);
      const title = $("h1").text();
      expect($("main h2").toArray().some(node => $(node).text() === title)).toBe(false);
      expect($(".admin-nav [aria-current=page]").length).toBe(1);
      expect($(".admin-table").toArray().every(table => $(table).closest(".admin-table-container").length)).toBe(true);
    }
    expect((await app.inject("/css/admin.css")).statusCode).toBe(200);
  });
  it("loads complete imported content into exactly one submitted field", async () => {
    const $ = load((await get(`/admin/pages/${home.id}/edit`)).payload);
    expect($('textarea[name="content"]').length).toBe(1);
    expect($('textarea[name="content"]').val()).toBe(home.content);
    expect($('input[name="slug"]').val()).toBe("");
    expect($("iframe").attr("sandbox")).toBe("allow-same-origin");
  });
  it("creates, edits, and reloads a page without losing HTML or publication state", async () => {
    const content = "<h2>A training update</h2><p>Steel &amp; practice</p>";
    const created = await post("/admin/pages", {
      title: "Training update",
      content,
      published: "on",
    });
    expect(created.statusCode).toBe(302);
    const page = await pagesRepo.findBySlug("training-update");
    const $ = load((await get(created.headers.location)).payload);
    expect($('textarea[name="content"]').val()).toBe(content);
    const saved = await post(`/admin/pages/${page.id}/edit`, {
      title: "Training update",
      slug: page.slug,
      content: "<p>New text</p>",
    });
    expect(saved.statusCode).toBe(302);
    expect((await pagesRepo.findById(page.id)).published).toBe(false);
    expect((await app.inject("/training-update")).statusCode).toBe(404);
    const flashCookie = saved.cookies.find((item) => item.name === "sessionId");
    expect(flashCookie).toBeDefined();
    const headers = { cookie: `${cookie}; sessionId=${flashCookie.value}` };
    const feedback = await app.inject({ url: saved.headers.location, headers });
    expect(feedback.payload).toContain("Page updated successfully");
    expect(
      (await app.inject({ url: saved.headers.location, headers })).payload,
    ).not.toContain("Page updated successfully");
    await pagesRepo.delete(page.id);
  });
  it("keeps invalid edits in the form without overwriting the stored page", async () => {
    const original = { ...home };
    const response = await post(`/admin/pages/${home.id}/edit`, {
      title: "Unsaved title",
      slug: "armor",
      content: "<p>Do not lose this work</p>",
      published: "on",
    });
    expect(response.statusCode).toBe(400);
    const $ = load(response.payload);
    expect($(".alert-error").text()).toContain("already uses");
    expect($('textarea[name="content"]').val()).toBe(
      "<p>Do not lose this work</p>",
    );
    expect((await pagesRepo.findById(home.id)).content).toBe(original.content);
  });
  it("keeps the homepage at / when its title changes", async () => {
    const original = { ...home };
    await post(`/admin/pages/${home.id}/edit`, {
      title: "Home revised",
      slug: "",
      content: home.content,
      published: "on",
    });
    expect((await pagesRepo.findById(home.id)).slug).toBe("");
    await pagesRepo.update(home.id, original);
  });
  it("returns a sanitized styled preview and requires authentication", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/pages/preview",
          payload: { content: "secret" },
        })
      ).statusCode,
    ).toBe(401);
    const response = await post("/admin/pages/preview", {
      id: home.id,
      content:
        '<p>Hello</p><script>alert(1)</script><img src="/x" onerror="alert(2)">',
    });
    expect(response.statusCode).toBe(200);
    expect(response.payload).toContain(home.styles[0]);
    expect(response.payload).not.toContain("<script>");
    expect(response.payload).not.toContain("onerror");
    expect(response.payload).toContain("script-src 'none'");
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it("rejects reserved addresses without discarding the new-page form", async () => {
    const response = await post("/admin/pages", {
      title: "Test",
      slug: "admin",
      content: "<p>Keep me</p>",
    });
    expect(response.statusCode).toBe(400);
    const $ = load(response.payload);
    expect($("form[data-page-editor]").attr("action")).toBe("/admin/pages");
    expect($('textarea[name="content"]').val()).toBe("<p>Keep me</p>");
  });
});
