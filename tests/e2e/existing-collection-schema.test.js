import { beforeAll, afterAll, it, expect } from "@jest/globals";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import { buildApp } from "../../src/app.js";
import {
  getDatabase,
  usersRepo,
  glossaryRepo,
  membersRepo,
  classesRepo,
  movesRepo,
  pagesRepo,
  updatesRepo,
} from "../../src/models/database.js";
import { authService } from "../../src/services/authService.js";
import { collectionStore } from "../../src/services/collections/store.js";
import { CollectionRepository } from "../../src/models/collectionRepository.js";
import {
  snapshotOf,
  inspectSnapshot,
  mergeCollections,
} from "../../src/services/dataTransfer/validation.js";
let app, cookie, csrf, term;
async function request(url, payload) {
  const response = await app.inject({
    url,
    method: payload ? "POST" : "GET",
    headers: { cookie, "x-csrf-token": csrf || "" },
    ...(payload ? { payload } : {}),
  });
  for (const item of response.cookies)
    if (item.name === "sessionId")
      cookie = cookie.split(";")[0] + `; sessionId=${item.value}`;
  return response;
}
const post = (action, payload) =>
  request("/admin/schema-api/" + action, payload);
async function until(predicate) {
  for (let i = 0; i < 150; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Generated UI did not settle");
}
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  cookie = `wcos_session=${authService.generateToken(await usersRepo.findByEmail("admin@wcos.org"))}`;
  csrf = (await request("/admin/schema-api/catalog")).json().csrf;
  term = await glossaryRepo.create({
    name: "Existing term",
    definition: "<p>Keep this definition</p>",
  });
});
afterAll(async () => app.close());
function browser(html) {
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
it("edits an existing Glossary schema through the visual builder, without redirecting to its index", async () => {
  const before = structuredClone(getDatabase().data.glossary);
  const dom = browser(
      (await request("/admin/settings/database-schema")).payload,
    ),
    doc = dom.window.document;
  await until(() =>
    [...doc.querySelectorAll("tr")].some((row) =>
      row.textContent.includes("glossary"),
    ),
  );
  const row = [...doc.querySelectorAll("tr")].find((row) =>
    row.textContent.includes("glossary"),
  );
  expect(row.querySelector("button").textContent).toBe("Edit schema");
  row.querySelector("button").click();
  const control = (text) =>
    [...doc.querySelectorAll("label")]
      .find((l) => l.querySelector("span")?.textContent === text)
      ?.querySelector("input,select,textarea");
  await until(() => control("Display label"));
  control("Display label").value = "Terminology";
  const click = (text) =>
    [...doc.querySelectorAll("button")]
      .find((b) => b.textContent === text)
      .click();
  click("Add field");
  await until(
    () =>
      [...doc.querySelectorAll("label")].filter(
        (l) => l.firstElementChild?.textContent === "Field identifier",
      ).length === 3,
  );
  const last = [...doc.querySelectorAll("details.schema-field")].at(-1);
  const input = (text) =>
    [...last.querySelectorAll("label")]
      .find((l) => l.querySelector("span")?.textContent === text)
      ?.querySelector("input,select");
  input("Field identifier").value = "priority";
  input("Label").value = "Priority";
  input("Type").value = "number";
  input("Type").dispatchEvent(new dom.window.Event("change"));
  input("Minimum value").value = "0";
  input("Maximum value").value = "10";
  click("Preview schema changes");
  await until(() => doc.body.textContent.includes("Apply previewed schema"));
  click("Apply previewed schema");
  await until(
    () => collectionStore.definition("glossary").label === "Terminology",
  );
  expect(getDatabase().data.glossary).toEqual(before);
  expect(getDatabase().data.dynamic.records.glossary).toBeUndefined();
  dom.window.close();
});
it("opens the actual generated record edit form and saves the newly defined field", async () => {
  const response = await request(`/admin/glossary/${term.id}/edit`);
  expect(response.statusCode).toBe(200);
  expect(response.headers.location).toBeUndefined();
  const dom = browser(response.payload),
    doc = dom.window.document;
  await until(
    () =>
      doc.querySelector("form [name=priority]") &&
      doc.querySelector("form")?.onsubmit,
  );
  expect(doc.querySelector("[name=name]").value).toBe("Existing term");
  doc.querySelector("[name=priority]").value = "7";
  doc
    .querySelector("form")
    .dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
  await until(() => getDatabase().data.glossary[0].priority === 7);
  expect((await glossaryRepo.findById(term.id)).definition).toBe(
    "<p>Keep this definition</p>",
  );
  dom.window.close();
  await expect(glossaryRepo.update(term.id, { priority: 100 })).rejects.toThrow(
    "validation",
  );
  expect((await glossaryRepo.findById(term.id)).priority).toBe(7);
});
it("uses one repository class and blocks incompatible schema changes and locked account fields", async () => {
  for (const repository of [
    pagesRepo,
    membersRepo,
    classesRepo,
    movesRepo,
    glossaryRepo,
    updatesRepo,
  ])
    expect(repository).toBeInstanceOf(CollectionRepository);
  const definition = collectionStore.definition("glossary");
  const preview = await post("preview-schema", {
    definition: {
      ...definition,
      fields: definition.fields.filter((f) => f.name !== "definition"),
      columns: ["name"],
    },
  });
  expect(preview.statusCode).toBe(200);
  expect(preview.json().errors).toEqual([]);
  expect(preview.json().warnings.join(" ")).toContain("definition");
  expect(
    (
      await post("preview-schema", {
        definition: { ...definition, id: "users" },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await post("save-record", {
        collection: "users",
        record: { name: "Bypass" },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await post("save-record", {
        collection: "glossary",
        id: term.id,
        record: { id: "overwrite" },
      })
    ).statusCode,
  ).toBe(400);
});
it("round-trips editable existing schemas and preserves original collection storage", () => {
  const data = getDatabase().data,
    backup = snapshotOf(data);
  expect(inspectSnapshot(backup, "restore")).toEqual([]);
  const { result } = mergeCollections({}, backup, "restore");
  expect(result.glossary).toEqual(data.glossary);
  expect(result.dynamic.definitions).toEqual(data.dynamic.definitions);
  expect(result.dynamic.records.glossary).toBeUndefined();
});

it.each(["members", "pages", "classes", "moves", "updates"])(
  "allows compatible schema edits on the existing %s collection",
  async (collection) => {
    const definition = collectionStore.definition(collection);
    const changed = {
      ...definition,
      label: `${collection} edited`,
      fields: [
        ...definition.fields,
        { name: "editorNote", label: "Editor note", type: "richtext" },
      ],
    };
    const preview = await post("preview-schema", { definition: changed });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().errors).toEqual([]);
    const saved = await post("save-schema", {
      definition: changed,
      revision: preview.json().revision,
    });
    expect(saved.statusCode).toBe(200);
    expect(collectionStore.definition(collection).label).toBe(
      `${collection} edited`,
    );
    expect(getDatabase().data.dynamic.records[collection]).toBeUndefined();
  },
);
it("sanitizes new rich-text fields on existing collections and enforces domain rules through generic CRUD", async () => {
  const created = await post("save-record", {
    collection: "members",
    record: {
      position: "Generic member",
      level: "L3",
      editorNote: "<script>bad()</script><p>Safe</p>",
    },
  });
  expect(created.statusCode).toBe(200);
  expect(created.json().editorNote).toBe("<p>Safe</p>");
  expect(created.json().circleName).toBe("L3");
  const invalidClass = await post("save-record", {
    collection: "classes",
    record: { name: "Invalid instructors", instructorIds: [created.json().id] },
  });
  expect(invalidClass.statusCode).toBe(400);
  const invalidDate = await post("save-record", {
    collection: "updates",
    record: { date: "2026-02-30", category: "news", body: "Invalid date" },
  });
  expect(invalidDate.statusCode).toBe(400);
});
it("warns, backs up and migrates existing records when a populated field is removed", async () => {
  const definition = {
    id: "scratchRecords",
    label: "Scratch records",
    fields: [
      { name: "name", type: "string", required: true },
      { name: "sourceUrl", type: "string" },
    ],
  };
  try {
    const created = await post("save-schema", {
      definition,
      revision: (await post("preview-schema", { definition })).json().revision,
    });
    expect(created.statusCode).toBe(200);
    const first = await post("save-record", {
      collection: "scratchRecords",
      record: { name: "Alpha", sourceUrl: "https://example.com/a" },
    });
    const second = await post("save-record", {
      collection: "scratchRecords",
      record: { name: "Beta", sourceUrl: "https://example.com/b" },
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const current = collectionStore.definition("scratchRecords");
    const withoutUrl = {
      ...current,
      fields: current.fields.filter((f) => f.name !== "sourceUrl"),
      columns: ["name"],
    };
    const removal = await post("preview-schema", { definition: withoutUrl });
    expect(removal.statusCode).toBe(200);
    expect(removal.json().errors).toEqual([]);
    expect(removal.json().warnings.join(" ")).toContain("sourceUrl");
    const applied = await post("save-schema", {
      definition: withoutUrl,
      revision: removal.json().revision,
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.json().backup).toMatch(/backup-schema-scratchRecords-\d+$/);
    expect(applied.json().warnings.join(" ")).toContain("sourceUrl");
    const rows = collectionStore.rows("scratchRecords");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.sourceUrl).toBeUndefined();
      expect(row.name).toMatch(/^(Alpha|Beta)$/);
    }
    const backup = JSON.parse(
      fs.readFileSync(applied.json().backup, "utf8"),
    );
    expect(
      backup.dynamic.records.scratchRecords
        .map((row) => row.sourceUrl)
        .filter(Boolean)
        .sort(),
    ).toEqual(["https://example.com/a", "https://example.com/b"]);
  } finally {
    if (collectionStore.definitions().some((d) => d.id === "scratchRecords")) {
      for (const row of collectionStore.rows("scratchRecords"))
        await post("delete-record", {
          collection: "scratchRecords",
          id: row.id,
        }).catch(() => {});
      await post("delete-schema", { id: "scratchRecords" }).catch(() => {});
    }
  }
  expect(
    collectionStore.definitions().some((d) => d.id === "scratchRecords"),
  ).toBe(false);
});
