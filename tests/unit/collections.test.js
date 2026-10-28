import { describe, it, expect } from "@jest/globals";
import {
  CollectionStore,
  revisionOf,
  validateState,
  assertNotReferenced,
  schemaChanges,
} from "../../src/services/collections/store.js";
import { normalizeDefinition } from "../../src/services/collections/schema.js";
import {
  normalizeView,
  queryView,
} from "../../src/services/collections/views.js";
const event = {
  id: "events",
  label: "Events",
  fields: [
    { name: "title", type: "string", required: true, unique: true },
    { name: "date", type: "date" },
    { name: "body", type: "richtext" },
  ],
};
function setup() {
  let data = { members: [{ id: "m1", name: "Member" }] };
  const adapter = {
    read: () => data,
    commit: async (candidate) => {
      data = candidate;
    },
  };
  return new CollectionStore(adapter, async () => "stub-backup");
}
async function define(store, definition) {
  return store.saveDefinition(definition, store.preview(definition).revision);
}
describe("Schema repository", () => {
  it("validates CRUD, uniqueness, dates, defaults, sanitization and protected fields", async () => {
    const store = setup();
    await define(store, event);
    await expect(store.saveRecord("events", {})).rejects.toThrow();
    await expect(
      store.saveRecord("events", { title: "Bad date", date: "2026-02-30" }),
    ).rejects.toThrow();
    const row = await store.saveRecord("events", {
      title: "Event",
      date: "2026-12-12",
      body: "<script>alert(1)</script><p>Safe</p>",
    });
    expect(row.body).toBe("<p>Safe</p>");
    await expect(
      store.saveRecord("events", { title: "Event" }),
    ).rejects.toThrow("unique");
    await expect(
      store.saveRecord("events", { id: "override", title: "x" }),
    ).rejects.toThrow("System");
    await store.saveRecord("events", { title: "Updated" }, row.id);
    expect(store.rows("events")[0].title).toBe("Updated");
    await expect(store.deleteDefinition("events")).rejects.toThrow();
    await store.deleteRecord("events", row.id);
    await store.deleteDefinition("events");
    expect(store.definitions().some((d) => d.id === "events")).toBe(false);
  });
  it("protects data and rejects stale previews, incompatible changes and unsafe input", async () => {
    const store = setup();
    await define(store, event);
    const preview = store.preview(event);
    await store.saveRecord("events", { title: "Keep" });
    await expect(store.saveDefinition(event, preview.revision)).rejects.toThrow(
      "changed",
    );
    const removal = store.preview({ ...event, fields: [] });
    expect(removal.errors).toEqual([]);
    expect(removal.warnings.join(" ")).toContain("title");
    // Removing populated fields migrates the records instead of blocking.
    await store.saveDefinition({ ...event, fields: [] }, removal.revision);
    expect(store.rows("events")[0]).not.toHaveProperty("title");
    expect(() => normalizeDefinition({ ...event, id: "__proto__" })).toThrow();
    expect(() => normalizeDefinition({ ...event, id: "users" })).toThrow();
    await expect(
      store.saveRecord("events", JSON.parse('{"__proto__":{"x":1}}')),
    ).rejects.toThrow();
    expect({}.x).toBeUndefined();
  });
  it("enforces relationship cardinality, existence and deletion restrictions", async () => {
    const store = setup();
    const definition = {
      ...event,
      fields: [
        ...event.fields,
        {
          name: "host",
          type: "relationship",
          target: "members",
          cardinality: "one-to-one",
        },
      ],
    };
    await define(store, definition);
    await expect(
      store.saveRecord("events", { title: "x", host: "missing" }),
    ).rejects.toThrow("referenced");
    await store.saveRecord("events", { title: "x", host: "m1" });
    await expect(
      store.saveRecord("events", { title: "y", host: "m1" }),
    ).rejects.toThrow("belongs");
    expect(() => assertNotReferenced(store.data(), "members", "m1")).toThrow();
    expect(() => validateState(store.data())).not.toThrow();
  });
  it("rolls back a failed adapter write and serializes concurrent uniqueness checks", async () => {
    const store = setup();
    await define(store, event);
    const result = await Promise.allSettled([
      store.saveRecord("events", { title: "Same" }),
      store.saveRecord("events", { title: "Same" }),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const before = revisionOf(store.data());
    store.adapter.commit = async () => {
      throw new Error("disk");
    };
    await expect(
      store.saveRecord("events", { title: "Failed" }),
    ).rejects.toThrow("disk");
    expect(revisionOf(store.data())).toBe(before);
  });
  it("queries AND/OR conditions, parameters, numeric sorting, projection and pagination", async () => {
    const store = setup();
    await define(store, event);
    for (const title of ["Event 10", "Event 2", "Other"])
      await store.saveRecord("events", { title, date: "2027-01-01" });
    const view = normalizeView(store.data(), {
      id: "upcoming",
      name: "Upcoming",
      collection: "events",
      public: true,
      fields: ["title"],
      pageSize: 1,
      sort: [{ field: "title", direction: "asc" }],
      filters: {
        logic: "and",
        conditions: [
          { field: "date", operator: "gte", relative: "today" },
          { field: "title", operator: "contains", parameter: "term" },
        ],
      },
      parameters: [{ name: "term", type: "string", default: "Event" }],
    });
    const result = queryView(
      store.data(),
      view,
      { page: 2 },
      { publicOnly: true },
    );
    expect(result.total).toBe(2);
    expect(result.records[0].title).toBe("Event 10");
    expect(result.records[0].date).toBeUndefined();
    expect(() =>
      queryView(
        store.data(),
        { ...view, public: false },
        {},
        { publicOnly: true },
      ),
    ).toThrow();
    expect(() =>
      normalizeView(store.data(), { ...view, collection: "users" }),
    ).toThrow();
    expect(() =>
      queryView(store.data(), view, { sort: "__proto__" }),
    ).toThrow();
  });
});

it("describes schema edits for backup metadata", () => {
  const store = setup();
  const definition = normalizeDefinition(event);
  const edited = normalizeDefinition({
    ...event,
    fields: [
      { name: "title", type: "string", required: true },
      { name: "venue", type: "string" },
    ],
    columns: ["title"],
  });
  const changes = schemaChanges(definition, edited, store.data());
  expect(changes.removed).toEqual([
    { name: "date", label: "date", type: "date", records: 0 },
    { name: "body", label: "body", type: "richtext", records: 0 },
  ]);
  expect(changes.added).toEqual([
    { name: "venue", label: "venue", type: "string" },
  ]);
  expect(changes.changed).toEqual([
    { name: "title", changes: { unique: { from: true, to: false } } },
  ]);
  expect(changes.summary).toContain("removed date (0 records)");
  expect(changes.summary).toContain("removed body (0 records)");
  expect(changes.summary).toContain("added venue (string)");
  expect(changes.summary).toContain("changed title (unique)");
});
it("applies defaults in compatible migrations and rejects incompatible enum, bounds and regex values", async () => {
  const store = setup();
  const definition = {
    id: "typed",
    label: "Typed records",
    fields: [
      { name: "name", type: "string", pattern: "^[A-Z]+$", min: 2, max: 8 },
      { name: "price", type: "number", min: 0, max: 100, default: 5 },
      { name: "active", type: "boolean", default: true },
      { name: "category", type: "enum", options: ["one", "two"] },
      { name: "tags", type: "array", min: 1, max: 3 },
      { name: "metadata", type: "object" },
      { name: "image", type: "media" },
    ],
  };
  await define(store, definition);
  for (const record of [
    { name: "bad" },
    { price: -1 },
    { active: "yes" },
    { category: "other" },
    { tags: [] },
    { metadata: [] },
    { image: "javascript:alert(1)" },
  ])
    await expect(store.saveRecord("typed", record)).rejects.toThrow();
  const row = await store.saveRecord("typed", {
    name: "GOOD",
    tags: ["a"],
    metadata: { nested: [1] },
    image: "/uploads/a.png",
  });
  expect(row.price).toBe(5);
  expect(row.active).toBe(true);
  const next = {
    ...definition,
    fields: [
      ...definition.fields,
      { name: "region", type: "string", default: "West", required: true },
    ],
  };
  await define(store, next);
  expect(store.rows("typed")[0].region).toBe("West");
  expect(
    store.preview({
      ...next,
      fields: next.fields.map((f) =>
        f.name === "price" ? { ...f, max: 1 } : f,
      ),
    }).errors.length,
  ).toBeGreaterThan(0);
});
it("supports one-to-many and many-to-many relationships and relationship query predicates", async () => {
  const store = setup();
  await define(store, {
    id: "media",
    label: "Media",
    fields: [
      { name: "url", type: "media" },
      { name: "name", type: "string" },
    ],
  });
  const image = await store.saveRecord("media", {
    url: "/uploads/photo.png",
    name: "Photo",
  });
  await define(store, {
    ...event,
    fields: [
      ...event.fields,
      {
        name: "photos",
        type: "relationship",
        target: "media",
        cardinality: "many-to-many",
      },
    ],
  });
  const a = await store.saveRecord("events", {
    title: "One",
    photos: [image.id],
  });
  await store.saveRecord("events", { title: "Two", photos: [image.id] });
  await expect(store.deleteRecord("media", image.id)).rejects.toThrow(
    "referenced",
  );
  const view = {
    id: "photos",
    name: "Photos",
    collection: "events",
    fields: ["title", "photos.url"],
    filters: {
      logic: "or",
      conditions: [
        { field: "photos.name", operator: "eq", value: "Photo" },
        { field: "title", operator: "eq", value: "Missing" },
      ],
    },
  };
  expect(queryView(store.data(), view).total).toBe(2);
  expect(
    store.preview({
      ...event,
      fields: [
        ...event.fields,
        {
          name: "photos",
          type: "relationship",
          target: "media",
          cardinality: "one-to-many",
        },
      ],
    }).errors.length,
  ).toBeGreaterThan(0);
  await store.deleteRecord("events", a.id);
  await define(store, {
    ...event,
    fields: [
      ...event.fields,
      {
        name: "photos",
        type: "relationship",
        target: "media",
        cardinality: "one-to-many",
      },
    ],
  });
});
