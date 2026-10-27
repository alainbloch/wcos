import { beforeAll, afterAll, it, expect } from "@jest/globals";
import { buildApp } from "../../src/app.js";
import { getDatabase, usersRepo } from "../../src/models/database.js";
import { authService } from "../../src/services/authService.js";
let app, cookie, csrf;
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const admin = await usersRepo.findByEmail("admin@wcos.org");
  cookie = `wcos_session=${authService.generateToken(admin)}`;
  const response = await app.inject({
    url: "/admin/schema-api/catalog",
    headers: { cookie },
  });
  csrf = response.json().csrf;
  cookie +=
    "; " +
    response.cookies
      .filter((c) => c.name === "sessionId")
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
});
afterAll(async () => {
  delete getDatabase().data.dynamic;
  await app.close();
});
const post = (action, payload) =>
  app.inject({
    method: "POST",
    url: `/admin/schema-api/${action}`,
    headers: { cookie, "x-csrf-token": csrf },
    payload,
  });
it("restricts all schema routes to authenticated admins with CSRF tokens", async () => {
  expect((await app.inject("/admin/schema-api/catalog")).statusCode).toBe(401);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/admin/schema-api/save-schema",
        headers: { cookie },
        payload: {},
      })
    ).statusCode,
  ).toBe(403);
  const user = await usersRepo.create({
    name: "Reader",
    email: "reader@example.com",
    role: "reader",
  });
  const denied = await app.inject({
    url: "/admin/settings/database-schema",
    headers: { cookie: `wcos_session=${authService.generateToken(user)}` },
  });
  expect(denied.statusCode).toBe(403);
  await usersRepo.delete(user.id);
});
it("creates a collection, exposes generated administration, returns inline errors, searches and edits records", async () => {
  const definition = {
    id: "events",
    label: "Events",
    fields: [
      { name: "title", label: "Title", type: "string", required: true },
      { name: "date", type: "date" },
      { name: "image", type: "media" },
    ],
  };
  const preview = await post("preview-schema", { definition });
  expect(preview.statusCode).toBe(200);
  expect(
    (
      await post("save-schema", {
        definition,
        revision: preview.json().revision,
      })
    ).statusCode,
  ).toBe(200);
  const error = await post("save-record", { collection: "events", record: {} });
  expect(error.statusCode).toBe(400);
  expect(error.json().fields.title).toBeDefined();
  const created = await post("save-record", {
    collection: "events",
    record: { title: "Tournament", date: "2027-02-01" },
  });
  expect(created.statusCode).toBe(200);
  for (const url of [
    "/admin/collections",
    "/admin/settings/database-schema",
    "/admin/data-views",
  ]) {
    const response = await app.inject({ url, headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.payload).toContain("collections-admin.js");
  }
  const records = await app.inject({
    url: "/admin/schema-api/records?collection=events&q=tournament",
    headers: { cookie },
  });
  expect(records.json().records).toHaveLength(1);
  expect(
    (
      await post("save-record", {
        collection: "events",
        id: created.json().id,
        replace: true,
        record: { title: "Updated" },
      })
    ).json().date,
  ).toBeUndefined();
  expect(
    (
      await post("save-view", {
        view: {
          id: "upcoming",
          name: "Upcoming Events",
          collection: "events",
          fields: ["title"],
          public: true,
        },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await post("preview-view", {
        view: {
          id: "upcoming",
          name: "Upcoming Events",
          collection: "events",
          fields: ["title"],
        },
      })
    ).json().total,
  ).toBe(1);
});
