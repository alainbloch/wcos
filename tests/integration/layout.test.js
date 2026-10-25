import { beforeAll, afterAll, it, expect } from "@jest/globals";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import {
  usersRepo,
  getDatabase,
  initDatabase,
} from "../../src/models/database.js";
import { authService } from "../../src/services/authService.js";
import { getLayout, layoutDefaults } from "../../src/services/layoutService.js";
import { migrateEditableLayout } from "../../src/models/migrations/editableLayout.js";
let app, cookie, csrf;
beforeAll(async () => {
  app = await buildApp();
  cookie = `wcos_session=${authService.generateToken(await usersRepo.findByEmail("admin@wcos.org"))}`;
  const response = await app.inject({
    url: "/admin/layout/header",
    headers: { cookie },
  });
  csrf = load(response.payload)('[name="_csrf"]').val();
  cookie += `; sessionId=${response.cookies.find((c) => c.name === "sessionId").value}`;
});
afterAll(async () => app.close());
const get = (url) => app.inject({ url, headers: { cookie } });
const post = (url, payload = {}) =>
  app.inject({
    method: "POST",
    url,
    headers: { cookie },
    payload: { _csrf: csrf, ...payload },
  });
it("shows editable defaults and protects mutations", async () => {
  expect((await app.inject("/admin/layout")).statusCode).toBe(401);
  for (const section of ["header", "footer", "css"]) {
    const response = await get(`/admin/layout/${section}`);
    expect(response.statusCode).toBe(200);
    expect(load(response.payload)("textarea").val()).toBe(
      (await layoutDefaults())[section],
    );
  }
  expect(
    (await post("/admin/layout/header", { content: "bad", _csrf: "" }))
      .statusCode,
  ).toBe(403);
  expect((await get("/admin/layout/unknown")).statusCode).toBe(404);
});
it("publishes header/footer templates and CSS on public pages but not admin", async () => {
  expect(
    (
      await post("/admin/layout/header", {
        content: "<header>Edited header {{ siteName }}</header>",
      })
    ).statusCode,
  ).toBe(302);
  expect(
    (
      await post("/admin/layout/footer", {
        content: "<footer>Edited footer {{ currentYear }}</footer>",
      })
    ).statusCode,
  ).toBe(302);
  expect(
    (await post("/admin/layout/css", { content: "header { color: red; }" }))
      .statusCode,
  ).toBe(302);
  for (const url of ["/", "/login", "/missing-layout-test"]) {
    const response = await app.inject(url);
    expect(response.payload).toContain("Edited header Western Circle");
    expect(response.payload).toContain(
      `Edited footer ${new Date().getFullYear()}`,
    );
    expect(response.payload).toContain("/reference-layout.css");
  }
  const css = await app.inject("/reference-layout.css");
  expect(css.headers["content-type"]).toContain("text/css");
  expect(css.payload).toBe("header { color: red; }");
  expect((await get("/admin")).payload).not.toContain("Edited header");
  await initDatabase();
  expect((await getLayout()).header).toContain("Edited header");
});
it("rejects malformed templates without replacing saved content and preserves the form", async () => {
  const before = await getLayout();
  const invalid = "{% if %}broken";
  const response = await post("/admin/layout/header", { content: invalid });
  expect(response.statusCode).toBe(400);
  expect(load(response.payload)("textarea").val()).toBe(invalid);
  expect((await getLayout()).header).toBe(before.header);
  expect(
    (
      await post("/admin/layout/header", {
        content: '{% include "partials/reference-header.njk" %}',
      })
    ).statusCode,
  ).toBe(400);
});
it("previews without publishing and restores shipped defaults", async () => {
  const before = await getLayout();
  const response = await post("/admin/layout/header/preview", {
    content: "<header>Preview {{ siteName }}</header>",
  });
  expect(response.statusCode).toBe(200);
  expect(response.payload).toContain("Preview Western Circle");
  expect(response.payload).toContain('id="editable-content"');
  expect(await getLayout()).toEqual(before);
  for (const section of ["header", "footer", "css"])
    expect((await post(`/admin/layout/${section}/restore`)).statusCode).toBe(
      302,
    );
  expect(await getLayout()).toEqual(await layoutDefaults());
});
it("migrates idempotently without recreating navigation or overwriting edits", async () => {
  const data = {
    siteSettings: { siteName: "Example" },
    navigation: [{ custom: ["saved in backup"] }],
    pages: [{ dataSources: ["navigation", "members"] }],
  };
  await migrateEditableLayout(data);
  expect(data.navigation).toBeUndefined();
  expect(data.pages[0].dataSources).toEqual(["members"]);
  data.siteSettings[0].referenceLayout.header = "";
  await migrateEditableLayout(data);
  expect(data.siteSettings[0].referenceLayout.header).toBe("");
  expect(getDatabase().data.navigation).toBeUndefined();
});
