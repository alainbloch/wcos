import { ensureReferencePages } from "../../src/services/referenceSiteService.js";
import {
  beforeAll,
  afterAll,
  beforeEach,
  it,
  expect,
  jest,
} from "@jest/globals";
import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import { getDatabase, usersRepo } from "../../src/models/database.js";
import config from "../../src/config/index.js";
import { authService } from "../../src/services/authService.js";
import { snapshotOf } from "../../src/services/dataTransfer/validation.js";
import {
  sha,
  jsonBytes,
  makeArchive,
  readArchive,
} from "../../src/services/dataTransfer/format.js";
import {
  exportData,
  buildPlan,
  stageImport,
  applyImport,
  listBackups,
  recoverTransfer,
} from "../../src/services/dataTransfer/service.js";
let app, cookie, csrf, baseline;
const media = Buffer.from("RIFF1234WEBPtest-media");
beforeAll(async () => {
  app = await buildApp();
  await ensureReferencePages();
  const user = await usersRepo.findByEmail("admin@wcos.org");
  cookie = `wcos_session=${authService.generateToken(user)}`;
  const response = await app.inject({
    url: "/admin/settings/data-transfer",
    headers: { cookie },
  });
  expect(response.statusCode).toBe(200);
  csrf = load(response.payload)('[name="_csrf"]').val();
  cookie += `; sessionId=${response.cookies.find((c) => c.name === "sessionId").value}`;
  baseline = structuredClone(getDatabase().data);
});
beforeEach(async () => {
  getDatabase().data = structuredClone(baseline);
  await getDatabase().write();
  await fs.rm(config.uploadDir, { recursive: true, force: true });
  await fs.mkdir(config.uploadDir, { recursive: true });
});
afterAll(async () => app.close());
const headers = () => ({
  cookie,
  "content-type": "application/octet-stream",
  "x-transfer-format": "json",
  "x-transfer-mode": "populate",
  "x-transfer-csrf": csrf,
});
it("provides Settings navigation, authenticated exports, and versioned round trips", async () => {
  expect((await app.inject("/admin/settings/data-transfer")).statusCode).toBe(
    401,
  );
  expect(
    (await app.inject({ url: "/admin/settings", headers: { cookie } })).payload,
  ).toContain("/admin/settings/data-transfer");
  getDatabase().data.resources = [
    { id: "legacy-resource", title: "Retired resource" },
  ];
  getDatabase().data.memberRosterManaged = true;
  for (const format of ["json", "zip"]) {
    const response = await app.inject({
      url: `/admin/settings/data-transfer/export/${format}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-disposition"]).toContain("." + format);
    const snapshot =
      format === "json"
        ? JSON.parse(response.payload)
        : readArchive(response.rawPayload).snapshot;
    expect(snapshot.version).toBe(1);
    expect(snapshot.collections.users[0].password).toMatch(/^\$2/);
    expect(snapshot.sessions).toBeUndefined();
    expect(snapshot.system.resources).toEqual(getDatabase().data.resources);
    expect(snapshot.system.memberRosterManaged).toBe(true);
    const plan = await buildPlan(
      response.rawPayload,
      format === "zip",
      "restore",
    );
    expect(plan.errors).toEqual([]);
  }
});
it("validates input, references, duplicates, and restore account safety", async () => {
  const snapshot = snapshotOf(baseline);
  snapshot.version = 999;
  expect(
    (await buildPlan(jsonBytes(snapshot), false, "restore")).errors,
  ).toContain(
    "Unsupported data format/version. Export a version 1 WCOS backup.",
  );
  snapshot.version = 1;
  snapshot.collections.moves = [
    { id: "move", name: "Broken", creatorId: "missing" },
  ];
  expect(
    (await buildPlan(jsonBytes(snapshot), false, "restore")).errors.join(),
  ).toContain("creatorId");
  snapshot.collections.moves = [];
  snapshot.collections.users = [];
  expect(
    (await buildPlan(jsonBytes(snapshot), false, "restore")).errors.join(),
  ).toContain("administrator");
  snapshot.collections.users = baseline.users;
  snapshot.collections.members = [
    { id: "same", position: "One" },
    { id: "same", position: "Two" },
  ];
  expect(
    (await buildPlan(jsonBytes(snapshot), false, "populate")).errors.join(),
  ).toContain("duplicate ID");
  snapshot.collections.members = [];
  snapshot.collections.users = [
    { ...baseline.users[0], password: "plaintext" },
  ];
  expect(
    (await buildPlan(jsonBytes(snapshot), false, "restore")).errors.join(),
  ).toContain("bcrypt");
  snapshot.collections.users = baseline.users;
  snapshot.collections.updates = [
    {
      id: "bad-date",
      date: "2025-02-30",
      category: "general",
      body: "<p>Test</p>",
    },
  ];
  expect(
    (await buildPlan(jsonBytes(snapshot), false, "restore")).errors.join(),
  ).toContain("date/category");
});
it("distinguishes populate, override and restore while keeping relationships", async () => {
  const incoming = snapshotOf(baseline);
  incoming.collections.members = [
    { id: "new-member", position: "Teacher", merits: ["Kaiden"] },
  ];
  incoming.collections.classes = [
    { id: "new-class", name: "Class", instructorIds: ["new-member"] },
  ];
  incoming.collections.pages = [{ ...baseline.pages[0], title: "Replacement" }];
  for (const mode of ["populate", "override", "restore"]) {
    const plan = await buildPlan(jsonBytes(incoming), false, mode);
    expect(plan.errors).toEqual([]);
    expect(plan.result.pages[0].title).toBe(
      mode === "populate" ? baseline.pages[0].title : "Replacement",
    );
    expect(plan.result.pages.length).toBe(
      mode === "restore" ? 1 : baseline.pages.length,
    );
    expect(plan.result.classes[0].instructorIds).toEqual(["new-member"]);
  }
});
it("rejects missing media and rewrites conflicting archive paths including HTML", async () => {
  await fs.writeFile(path.join(config.uploadDir, "portrait.webp"), media);
  const incoming = snapshotOf(baseline);
  incoming.collections.members = [
    { id: "image-member", position: "Image", image: "/uploads/portrait.webp" },
  ];
  incoming.collections.pages = [
    {
      id: "image-page",
      title: "Image page",
      slug: "image-page",
      content: '<img src="/uploads/portrait.webp?size=1">',
    },
  ];
  const other = Buffer.from("RIFF5678WEBPdifferent");
  const zip = makeArchive(incoming, new Map([["portrait.webp", other]]));
  const plan = await buildPlan(zip, true, "override");
  expect(plan.errors).toEqual([]);
  const target = plan.mediaChanges[0].target;
  expect(target).not.toBe("portrait.webp");
  expect(plan.result.members[0].image).toBe("/uploads/" + target);
  expect(
    plan.result.pages.find((p) => p.id === "image-page").content,
  ).toContain(target + "?size=1");
  await fs.rm(path.join(config.uploadDir, "portrait.webp"));
  expect(
    (await buildPlan(jsonBytes(incoming), false, "restore")).errors.join(),
  ).toContain("missing /uploads/portrait.webp");
});
it("stages through HTTP without writes, hides hashes in preview, and requires confirmation", async () => {
  const incoming = snapshotOf(baseline);
  incoming.collections.members.push({
    id: "preview-member",
    position: "Preview",
  });
  let response = await app.inject({
    method: "POST",
    url: "/admin/settings/data-transfer/upload",
    headers: { ...headers(), "x-transfer-csrf": "wrong" },
    payload: jsonBytes(incoming),
  });
  expect(response.statusCode).toBe(403);
  response = await app.inject({
    method: "POST",
    url: "/admin/settings/data-transfer/upload",
    headers: headers(),
    payload: jsonBytes(incoming),
  });
  expect(response.statusCode).toBe(200);
  const preview = await app.inject({
    url: response.json().location,
    headers: { cookie },
  });
  expect(preview.statusCode).toBe(200);
  expect(preview.payload).not.toContain(baseline.users[0].password);
  expect(
    getDatabase().data.members.some((m) => m.id === "preview-member"),
  ).toBe(false);
  const token = load(preview.payload)('[name="token"]').val();
  expect(token).toBeTruthy();
  const denied = await app.inject({
    method: "POST",
    url: "/admin/settings/data-transfer/apply",
    headers: { cookie },
    payload: { _csrf: csrf, token },
  });
  expect(denied.statusCode).toBe(400);
  const applied = await app.inject({
    method: "POST",
    url: "/admin/settings/data-transfer/apply",
    headers: { cookie },
    payload: { _csrf: csrf, token, confirm: "yes" },
  });
  expect(applied.statusCode).toBe(302);
  expect(applied.headers.location).toBe("/login");
  expect(
    getDatabase().data.members.some((m) => m.id === "preview-member"),
  ).toBe(true);
  expect((await listBackups()).length).toBeGreaterThan(0);
});
it("rejects stale or other-session previews and only applies a preview once", async () => {
  const bytes = await exportData();
  let preview = await stageImport(bytes, false, "override", "owner");
  await expect(applyImport(preview.token, "other")).rejects.toThrow(
    "another session",
  );
  getDatabase().data.members.push({ id: "changed", position: "Change" });
  await expect(applyImport(preview.token, "owner")).rejects.toThrow(
    "changed since preview",
  );
  preview = await stageImport(await exportData(), false, "override", "owner");
  await applyImport(preview.token, "owner");
  await expect(applyImport(preview.token, "owner")).rejects.toThrow(
    "already applied",
  );
});
it("rolls back both media and database when database persistence fails", async () => {
  await fs.writeFile(path.join(config.uploadDir, "old.webp"), media);
  const incoming = snapshotOf(baseline);
  incoming.collections.members = [{ id: "new", position: "New" }];
  const zip = makeArchive(incoming, new Map([["new.webp", media]]));
  const preview = await stageImport(zip, true, "restore", "owner");
  const spy = jest
    .spyOn(getDatabase(), "write")
    .mockRejectedValueOnce(new Error("disk failure"));
  try {
    await expect(applyImport(preview.token, "owner")).rejects.toThrow(
      "were restored",
    );
  } finally {
    spy.mockRestore();
  }
  expect(getDatabase().data).toEqual(baseline);
  expect(await fs.readFile(path.join(config.uploadDir, "old.webp"))).toEqual(
    media,
  );
  await expect(
    fs.stat(path.join(config.uploadDir, "new.webp")),
  ).rejects.toThrow();
  expect(JSON.parse(await fs.readFile(config.dbPath, "utf8"))).toEqual(
    baseline,
  );
});
it("revokes existing sessions on a restore and creates a usable recovery archive", async () => {
  const preview = await stageImport(
    await exportData(true),
    true,
    "restore",
    "owner",
  );
  const result = await applyImport(preview.token, "owner");
  expect(
    (await app.inject({ url: "/admin", headers: { cookie } })).statusCode,
  ).toBe(401);
  const file = path.join(
    path.dirname(path.resolve(config.dbPath)),
    ".wcos-transfer",
    "backups",
    result.backupName,
  );
  expect(
    readArchive(await fs.readFile(file)).snapshot.collections.users,
  ).toEqual(baseline.users);
});
it("recovers an interrupted media swap before startup", async () => {
  const id = "12345678-1234-1234-1234-123456789abc",
    parent = path.dirname(path.resolve(config.uploadDir)),
    old = path.join(parent, `.wcos-import-${id}.old`);
  await fs.writeFile(path.join(config.uploadDir, "old.webp"), media);
  await fs.rename(config.uploadDir, old);
  await fs.mkdir(config.uploadDir);
  await fs.writeFile(path.join(config.uploadDir, "new.webp"), media);
  const root = path.join(
    path.dirname(path.resolve(config.dbPath)),
    ".wcos-transfer",
  );
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(
    path.join(root, "transaction.json"),
    jsonBytes({ id, phase: "prepared", hadUploads: true, original: baseline }),
  );
  await recoverTransfer();
  expect(await fs.readFile(path.join(config.uploadDir, "old.webp"))).toEqual(
    media,
  );
  await expect(
    fs.stat(path.join(config.uploadDir, "new.webp")),
  ).rejects.toThrow();
});

it("restores a blank draft and keeps imported collections empty after restart", async () => {
  const incoming = snapshotOf(baseline);
  incoming.collections.pages = [
    {
      id: "draft",
      title: "Draft",
      slug: "draft",
      content: "",
      published: false,
    },
  ];
  incoming.collections.updates = [];
  incoming.collections.glossary = [];
  incoming.collections.members = [
    { id: "restored-member", position: "Restored" },
  ];
  const preview = await stageImport(
    jsonBytes(incoming),
    false,
    "restore",
    "owner",
  );
  expect(preview.errors).toEqual([]);
  await applyImport(preview.token, "owner");
  const { initDatabase } = await import("../../src/models/database.js");
  await initDatabase();
  expect(getDatabase().data.updates).toEqual([]);
  expect(getDatabase().data.glossary).toEqual([]);
  expect(getDatabase().data.members).toHaveLength(1);
  expect(getDatabase().data.pages).toHaveLength(1);
});
