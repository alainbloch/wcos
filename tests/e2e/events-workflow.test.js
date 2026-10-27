import { beforeAll, afterAll, it, expect } from "@jest/globals";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import { buildApp } from "../../src/app.js";
import {
  getDatabase,
  usersRepo,
  pagesRepo,
} from "../../src/models/database.js";
import { authService } from "../../src/services/authService.js";
import { collectionStore } from "../../src/services/collections/store.js";
import { viewService } from "../../src/services/collections/views.js";
import {
  snapshotOf,
  inspectSnapshot,
  mergeCollections,
  validateDatabase,
} from "../../src/services/dataTransfer/validation.js";
let app, cookies, csrf;
async function request(url, payload) {
  const response = await app.inject({
    url,
    method: payload ? "POST" : "GET",
    headers: { cookie: cookies, "x-csrf-token": csrf || "" },
    ...(payload ? { payload } : {}),
  });
  for (const cookie of response.cookies)
    if (cookie.name === "sessionId")
      cookies = cookies.split(";")[0] + `; sessionId=${cookie.value}`;
  return response;
}
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  cookies = `wcos_session=${authService.generateToken(await usersRepo.findByEmail("admin@wcos.org"))}`;
  csrf = (await request("/admin/schema-api/catalog")).json().csrf;
});
afterAll(async () => {
  await app.close();
});
async function until(test) {
  for (let i = 0; i < 100; i++) {
    if (test()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("UI did not settle");
}
function ui(html) {
  const dom = new JSDOM(html, {
    url: "http://localhost/admin/settings/database-schema",
    runScripts: "outside-only",
  });
  dom.window.fetch = async (url, options = {}) => {
    const response = await request(
      url,
      options.body ? JSON.parse(options.body) : undefined,
    );
    return {
      ok: response.statusCode < 400,
      json: async () => response.json(),
      text: async () => response.payload,
    };
  };
  dom.window.confirm = () => true;
  dom.window.eval(fs.readFileSync("public/js/collections-admin.js", "utf8"));
  return dom;
}
it("creates an Events schema and a record through the generated browser DOM interface", async () => {
  const dom = ui((await request("/admin/settings/database-schema")).payload),
    doc = dom.window.document;
  const click = (text) => {
    const el = [...doc.querySelectorAll("button")].find(
      (b) => b.textContent === text,
    );
    expect(el).toBeDefined();
    el.click();
  };
  const control = (text) =>
    [...doc.querySelectorAll("label")]
      .find((l) => l.firstElementChild?.textContent === text)
      ?.querySelector("input,select,textarea");
  await until(() => doc.body.textContent.includes("Create collection"));
  click("Create collection");
  await until(() => control("Identifier"));
  control("Identifier").value = "events";
  control("Display label").value = "Events";
  click("Add field");
  await until(() => control("Field identifier"));
  control("Field identifier").value = "title";
  control("Label").value = "Title";
  control("Required").checked = true;
  click("Preview schema changes");
  await until(() => doc.body.textContent.includes("Apply previewed schema"));
  click("Apply previewed schema");
  await until(() =>
    collectionStore.definitions().some((d) => d.id === "events"),
  );
  dom.window.close();
  const records = ui((await request("/admin/collections")).payload),
    rd = records.window.document;
  await until(() => rd.querySelector("select"));
  const choice = rd.querySelector("select");
  choice.value = "events";
  choice.dispatchEvent(new records.window.Event("change"));
  await until(() =>
    [...rd.querySelectorAll("button")].some(
      (b) => b.textContent === "Create record",
    ),
  );
  [...rd.querySelectorAll("button")]
    .find((b) => b.textContent === "Create record")
    .click();
  await until(() => rd.querySelector("[name=title]"));
  rd.querySelector("[name=title]").value = "Public Tournament";
  rd.querySelector("form").dispatchEvent(
    new records.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => collectionStore.rows("events").length === 1);
  expect(collectionStore.rows("events")[0].title).toBe("Public Tournament");
  records.window.close();
});
it("renders actual paginated records in unsaved previews and public pages with matching output", async () => {
  const def = {
    id: "events",
    label: "Events",
    fields: [
      { name: "title", type: "string", required: true },
      { name: "date", type: "date" },
      { name: "image", type: "media" },
    ],
  };
  await collectionStore.saveDefinition(
    def,
    collectionStore.preview(def).revision,
  );
  for (const title of ["Autumn Tournament", "Winter Tournament"])
    await collectionStore.saveRecord("events", {
      title,
      date: "2099-01-01",
      image: "/images/test.png",
    });
  await viewService.save({
    id: "upcoming",
    name: "Upcoming Events",
    collection: "events",
    public: true,
    fields: ["title", "date", "image"],
    filters: {
      logic: "and",
      conditions: [{ field: "date", operator: "gte", relative: "today" }],
    },
    sort: [{ field: "title", direction: "asc" }],
    pageSize: 1,
  });
  const binding = {
    id: "upcoming",
    layout: "grid",
    pagination: "numbered",
    search: true,
    sorting: true,
  };
  const draft = {
    content: "<h2>Unsaved heading</h2>",
    dataSources: ["view:upcoming"],
    dataView: binding,
  };
  const preview = await request("/admin/pages/preview", draft);
  expect(preview.statusCode).toBe(200);
  expect(preview.payload).toContain("Autumn Tournament");
  expect(preview.payload).not.toContain("Winter Tournament");
  expect(preview.payload).toContain("page=2");
  expect(preview.payload).toContain("Unsaved heading");
  const second = await request("/admin/pages/preview", {
    ...draft,
    query: { page: 2 },
  });
  expect(second.payload).toContain("Winter Tournament");
  const pageResponse = await request("/admin/pages", {
    title: "Events",
    slug: "events",
    content: "<h2>Published heading</h2>",
    published: "on",
    dataSources: ["view:upcoming"],
    dataView: binding,
  });
  expect(pageResponse.statusCode).toBe(302);
  const publicPage = await app.inject("/events");
  expect(publicPage.statusCode).toBe(200);
  expect(publicPage.payload).toContain("Autumn Tournament");
  const previewDoc = new JSDOM(preview.payload),
    publicDoc = new JSDOM(publicPage.payload);
  expect(previewDoc.window.document.querySelector(".data-view").outerHTML).toBe(
    publicDoc.window.document.querySelector(".data-view").outerHTML,
  );
  const stored = await pagesRepo.findBySlug("events");
  expect(stored.content).not.toContain("Unsaved");
  expect((await app.inject("/events?page=2")).payload).toContain(
    "Winter Tournament",
  );
  const record = collectionStore
    .rows("events")
    .find((r) => r.title === "Winter Tournament");
  const detail = await app.inject(`/events?record=${record.id}`);
  expect(detail.payload).toContain("Winter Tournament");
  expect(detail.payload).not.toContain("Autumn Tournament");
  const changed = await request(`/admin/pages/${stored.id}/edit`, {
    title: stored.title,
    slug: stored.slug,
    content: stored.content,
    published: "on",
    viewId: "upcoming",
    viewLayout: "list",
    viewPagination: "more",
  });
  expect(changed.statusCode).toBe(302);
  expect((await app.inject("/events")).payload).toContain("data-view-more");
  const edit = await request(`/admin/pages/${stored.id}/edit`);
  expect(edit.payload).toContain("Data view: Upcoming Events");
  expect(edit.payload).toContain("data-live-preview");
  previewDoc.window.close();
  publicDoc.window.close();
});
it("round-trips definitions, records, relationships, named views and page configuration", async () => {
  const before = structuredClone(getDatabase().data),
    backup = snapshotOf(before);
  expect(inspectSnapshot(backup, "restore")).toEqual([]);
  const { result } = mergeCollections({}, backup, "restore");
  expect(result.dynamic).toEqual(before.dynamic);
  expect(result.pages).toEqual(before.pages);
  expect(validateDatabase(result)).toEqual([]);
  const bad = structuredClone(backup);
  bad.system.dynamic.records.events[0].title = 123;
  expect(inspectSnapshot(bad, "restore").length).toBeGreaterThan(0);
  const bound = viewService.list().find((v) => v.id === "upcoming");
  await expect(viewService.save({ ...bound, public: false })).rejects.toThrow(
    "private",
  );
  await expect(viewService.delete("upcoming")).rejects.toThrow("bound");
});
