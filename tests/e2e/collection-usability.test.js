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
  dom.window.structuredClone = structuredClone;
  dom.window.confirm = () => true;
  dom.window.eval(fs.readFileSync("public/js/collections-admin.js", "utf8"));
  return dom;
}

const click = (doc, text) =>
  [...doc.querySelectorAll("button")]
    .find((b) => b.textContent === text)
    .click();
it.each(["members", "pages", "classes", "glossary", "updates", "moves"])(
  "%s has its own compact index without a collection selector",
  async (collection) => {
    const dom = browser((await request(`/admin/${collection}`)).payload),
      doc = dom.window.document;
    await until(() => doc.querySelector(".collection-toolbar"));
    expect(
      [...doc.querySelectorAll("label")].some(
        (label) => label.textContent.trim() === "Collection",
      ),
    ).toBe(false);
    expect(doc.querySelector("[aria-label='Data management']")).toBeNull();
    expect(
      doc.querySelector(".collection-heading .btn-primary").textContent,
    ).toMatch(/^Add /);
    expect(doc.querySelector("[data-message]").hidden).toBe(true);
    expect(doc.querySelector(".admin-heading h1").textContent).toBe(
      collectionStore.definition(collection).label,
    );
    dom.window.close();
  },
);
it("uses move checkboxes and structured media entries, preserving values after save", async () => {
  const move = await movesRepo.create({
    name: "Jumping Tiger",
    types: ["Initiated Response"],
    core: true,
    media: [
      { type: "image", url: "/uploads/front.png", caption: "Front" },
      { type: "image", url: "/uploads/side.png", caption: "Side" },
    ],
  });
  const dom = browser((await request(`/admin/moves/${move.id}/edit`)).payload),
    doc = dom.window.document;
  await until(() => doc.querySelector("form")?.onsubmit);
  expect(doc.querySelector("textarea[name=types]")).toBeNull();
  expect(doc.querySelector("textarea[name=media]")).toBeNull();
  expect(doc.querySelector(".collection-multiselect summary").textContent).toBe(
    "Initiated Response",
  );
  const checkbox = [...doc.querySelectorAll(".collection-multiselect label")]
    .find((l) => l.textContent === "Straight Offense")
    .querySelector("input");
  checkbox.click();
  const media = [...doc.querySelectorAll("fieldset")].find(
    (f) => f.querySelector("legend")?.textContent === "Images and videos",
  );
  const second = media.querySelectorAll(".collection-item")[1];
  click(second, "Move up");
  await until(
    () =>
      JSON.parse(doc.querySelector("input[name=media]").value)[0].caption ===
      "Side",
  );
  doc
    .querySelector("form")
    .dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
  await until(
    () =>
      getDatabase().data.moves.find((r) => r.id === move.id).types.length === 2,
  );
  const saved = await movesRepo.findById(move.id);
  expect(saved.types).toEqual(["Initiated Response", "Straight Offense"]);
  expect(saved.media.map((m) => m.caption)).toEqual(["Side", "Front"]);
  dom.window.close();
});
it("restores rank dropdowns and member field sections", async () => {
  const member = await membersRepo.create({
    position: "Test fighter",
    level: "L3",
    steelRank: "L2",
    active: true,
  });
  const dom = browser(
      (await request(`/admin/members/${member.id}/edit`)).payload,
    ),
    doc = dom.window.document;
  await until(() => doc.querySelector("form")?.onsubmit);
  expect(doc.querySelector("select[name=level]").value).toBe("L3");
  expect(doc.querySelector("select[name=steelRank]").value).toBe("L2");
  expect(
    [...doc.querySelectorAll("legend")].map((el) => el.textContent),
  ).toContain("Council");
  dom.window.close();
});
it("collapses schema fields by default and supports expand/collapse all", async () => {
  const dom = browser(
      (await request("/admin/settings/database-schema")).payload,
    ),
    doc = dom.window.document;
  await until(() =>
    [...doc.querySelectorAll("tr")].some((r) =>
      r.textContent.includes("moves"),
    ),
  );
  const row = [...doc.querySelectorAll("tr")].find((r) =>
    r.textContent.includes("moves"),
  );
  row.querySelector("button").click();
  await until(() => doc.querySelector("details.schema-field"));
  expect(
    [...doc.querySelectorAll("details.schema-field")].every((d) => !d.open),
  ).toBe(true);
  click(doc, "Expand all fields");
  await until(() =>
    [...doc.querySelectorAll("details.schema-field")].every((d) => d.open),
  );
  click(doc, "Collapse all fields");
  await until(() =>
    [...doc.querySelectorAll("details.schema-field")].every((d) => !d.open),
  );
  dom.window.close();
});
it("applies the same UI to a custom collection and validates multiple choices", async () => {
  const def = {
    id: "events_ui",
    label: "Events",
    singularLabel: "Event",
    fields: [
      { name: "title", label: "Title", type: "string" },
      {
        name: "tags",
        label: "Tags",
        type: "array",
        options: ["Training", "Tournament"],
        control: "multiselect",
      },
    ],
    columns: ["title", "tags"],
  };
  await collectionStore.saveDefinition(
    def,
    collectionStore.preview(def).revision,
  );
  const dom = browser(
      (await request("/admin/collections/events_ui/new")).payload,
    ),
    doc = dom.window.document;
  await until(() => doc.querySelector("form")?.onsubmit);
  expect(doc.querySelector(".collection-multiselect")).not.toBeNull();
  expect(doc.querySelector("textarea[name=tags]")).toBeNull();
  doc.querySelector("[name=title]").value = "Spring event";
  doc.querySelector(".collection-multiselect input").click();
  doc
    .querySelector("form")
    .dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
  await until(() => collectionStore.rows("events_ui").length === 1);
  expect(collectionStore.rows("events_ui")[0].tags).toEqual(["Training"]);
  await expect(
    collectionStore.saveRecord("events_ui", {
      title: "Bad",
      tags: ["Unknown"],
    }),
  ).rejects.toThrow("validation");
  dom.window.close();
});
it("offers readable values, delete and persistent ordering on the index", async () => {
  const dom = browser((await request("/admin/moves")).payload),
    doc = dom.window.document;
  await until(() => doc.querySelector(".collection-row-actions"));
  expect(doc.querySelector("table").textContent).toContain("Yes");
  expect(doc.querySelector("table").textContent).not.toContain("true");
  expect(
    [...doc.querySelectorAll("button")].some((b) => b.textContent === "Delete"),
  ).toBe(true);
  expect(doc.querySelector("button[aria-label$='up']")).not.toBeNull();
  dom.window.close();
});
