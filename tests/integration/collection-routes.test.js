import { beforeAll, afterAll, it, expect } from "@jest/globals";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import { usersRepo, pagesRepo } from "../../src/models/database.js";
import { authService } from "../../src/services/authService.js";
import { collectionStore } from "../../src/services/collections/store.js";
import { adminSession } from "../helpers/admin-session.js";
let app, cookie, csrf, first, second;
const request = (url, payload, token = csrf) =>
  app.inject({
    url,
    method: payload === undefined ? "GET" : "POST",
    headers: { cookie, "x-csrf-token": token },
    ...(payload === undefined ? {} : { payload }),
  });
beforeAll(async () => {
  app = await buildApp();
  ({ cookie, csrf } = await adminSession(
    app,
    `wcos_session=${authService.generateToken(await usersRepo.findByEmail("admin@wcos.org"))}`,
  ));
  const def = {
    id: "articles",
    label: "Articles",
    singularLabel: "Article",
    capabilities: { design: true, preview: true },
    contentField: "body",
    orderField: "sortOrder",
    fields: [
      { name: "title", type: "string" },
      { name: "body", type: "richtext" },
      { name: "sortOrder", type: "number" },
    ],
    columns: ["title"],
  };
  await collectionStore.saveDefinition(
    def,
    collectionStore.preview(def).revision,
  );
  first = await collectionStore.saveRecord("articles", {
    title: "First",
    body: "<p>Saved body</p>",
    sortOrder: 0,
  });
  second = await collectionStore.saveRecord("articles", {
    title: "Second",
    body: "<p>Other</p>",
    sortOrder: 1,
  });
});
afterAll(async () => app.close());
it("builds navigation from live schemas on all admin pages and marks design routes active", async () => {
  const $ = load(
    (await request(`/admin/collections/articles/${first.id}/design?tab=html`))
      .payload,
  );
  expect(
    $('.admin-nav a[href="/admin/collections/articles"]').text().trim(),
  ).toBe("Articles");
  expect($(".admin-nav a[aria-current=page]").attr("href")).toBe(
    "/admin/collections/articles",
  );
  expect($("form[data-page-editor]").attr("data-preview-url")).toBe(
    "/admin/collections/articles/preview",
  );
  expect($("textarea[name=content]").val()).toBe("<p>Saved body</p>");
  expect($("[name=_csrf]").val()).toBe(csrf);
});
it("previews an unsaved record using its own collection without publishing", async () => {
  const response = await request("/admin/collections/articles/preview", {
    id: first.id,
    content: "<p>Draft body</p>",
  });
  expect(response.statusCode).toBe(200);
  expect(response.payload).toContain("Draft body");
  expect(collectionStore.rows("articles")[0].body).toBe("<p>Saved body</p>");
  const page = await pagesRepo.create({
    title: "Other collection",
    slug: "other-collection",
    content: "Private mismatch",
  });
  expect(
    (await request("/admin/collections/articles/preview", { id: page.id }))
      .statusCode,
  ).toBe(404);
});
it("saves custom designer content to the schema-selected field", async () => {
  const response = await request(
    `/admin/collections/articles/${first.id}/edit`,
    { _design: "true", title: "Changed", content: "<p>Updated</p>" },
  );
  expect(response.statusCode).toBe(302);
  expect(response.headers.location).toBe(
    `/admin/collections/articles/${first.id}/edit`,
  );
  expect(collectionStore.rows("articles")[0]).toMatchObject({
    title: "Changed",
    body: "<p>Updated</p>",
    sortOrder: 0,
  });
});
it("supports ordering for custom collections and legacy aliases with CSRF protection", async () => {
  expect(
    (
      await request("/admin/collections/articles/order", {
        ids: [second.id, first.id],
      })
    ).statusCode,
  ).toBe(200);
  expect(collectionStore.rows("articles").map((r) => r.id)).toEqual([
    second.id,
    first.id,
  ]);
  expect(
    (await request("/admin/articles/order", { ids: [first.id, second.id] }, ""))
      .statusCode,
  ).toBe(403);
  expect(
    (await request("/admin/articles/order", { ids: [first.id, second.id] }))
      .statusCode,
  ).toBe(200);
  expect(
    (await request("/admin/collections/articles/media", {}, "")).statusCode,
  ).toBe(403);
  expect(
    (await request("/admin/collections/articles/media", {})).statusCode,
  ).toBe(400);
});
it("rejects unsupported operations, unknown collections, locked collections and invalid tokens", async () => {
  expect(
    (await request("/admin/collections/moves/preview", { content: "x" }))
      .statusCode,
  ).toBe(404);
  expect(
    (await request("/admin/collections/moves/unknown/design")).statusCode,
  ).toBe(404);
  expect((await request("/admin/collections/missing")).statusCode).toBe(404);
  expect((await request("/admin/collections/users/media", {})).statusCode).toBe(
    403,
  );
  expect(
    (
      await request(
        "/admin/collections/articles/preview",
        { content: "x" },
        "é".repeat(csrf.length),
      )
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/admin/collections/articles/preview",
        payload: {},
      })
    ).statusCode,
  ).toBe(401);
  expect((await request(`/admin/page-design/${first.id}`)).statusCode).toBe(
    404,
  );
});

it("gives new collections schema-owned ordering without modifying existing member position values", async () => {
  const definition = {
    id: "ordered_events",
    label: "Events",
    fields: [{ name: "title", type: "string" }],
  };
  const preview = collectionStore.preview(definition);
  expect(preview.definition.orderField).toBe("sortOrder");
  await collectionStore.saveDefinition(preview.definition, preview.revision);
  const a = await collectionStore.saveRecord("ordered_events", { title: "A" });
  const b = await collectionStore.saveRecord("ordered_events", { title: "B" });
  expect([a.sortOrder, b.sortOrder]).toEqual([0, 1]);
  expect(
    (
      await request("/admin/collections/ordered_events/order", {
        ids: [b.id, a.id],
      })
    ).statusCode,
  ).toBe(200);
  expect(
    collectionStore
      .definition("members")
      .fields.find((f) => f.name === "position").type,
  ).toBe("string");
});
