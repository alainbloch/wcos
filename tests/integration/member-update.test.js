import {
  beforeAll,
  afterAll,
  afterEach,
  it,
  expect,
  jest,
} from "@jest/globals";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import {
  membersRepo,
  usersRepo,
  getDatabase,
} from "../../src/models/database.js";
import { authService } from "../../src/services/authService.js";
import { collectionStore } from "../../src/services/collections/store.js";

let app, cookie, member;
const values = {
  circleName: "Steel Wind",
  level: "L4",
  steelRank: "L3",
  position: "Instructor",
  merits: " Council \r\n\r\n Medical Officer ",
  biography: "New <strong>biography</strong>",
  region: "Seattle",
  memberSince: "2004",
  email: "member@example.com",
  yearsFought: "20",
  battlesFought: "100",
  steelBattlesFought: "30",
  opponentsFought: "50",
  weaponType: "Sword",
  statsUpdated: "2026",
};
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  cookie = `wcos_session=${authService.generateToken(await usersRepo.findByEmail("admin@wcos.org"))}`;
  member = await membersRepo.create({
    position: "Original",
    circleName: "L1",
    level: "L1",
    merits: ["Old"],
    active: true,
  });
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await membersRepo.delete(member.id);
  await app.close();
});
const url = () => `/admin/members/${member.id}/edit`;
function post(payload, encoding = "json", target = url()) {
  const headers = { cookie };
  if (encoding === "urlencoded") {
    headers["content-type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(payload).toString();
  } else if (encoding === "multipart") {
    headers["content-type"] = "multipart/form-data; boundary=member-test";
    payload =
      Object.entries(payload)
        .flatMap(([key, value]) =>
          (Array.isArray(value) ? value : [value]).map(
            (item) =>
              `--member-test\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${item}\r\n`,
          ),
        )
        .join("") + "--member-test--\r\n";
  }
  return app.inject({ method: "POST", url: target, headers, payload });
}

it.each(["json", "urlencoded", "multipart"])(
  "saves and reloads every member field using %s",
  async (encoding) => {
    const response = await post(values, encoding);
    expect(response.statusCode).toBe(302);
    const saved = await membersRepo.findById(member.id);
    expect(saved).toMatchObject({
      position: "Steel Wind",
      circleName: "L4 - l3",
      steelRank: "L3",
      active: false,
      merits: ["Instructor", "Council", "Medical Officer"],
    });
    expect(() => JSON.stringify(getDatabase().data)).not.toThrow();
    const $ = load(
      (await app.inject({ url: url(), headers: { cookie } })).payload,
    );
    for (const [key, value] of Object.entries(values)) {
      if (!["merits", "circleName", "position"].includes(key)) expect($(`[name="${key}"]`).val()).toBe(value);
    }
    expect($('[name="position"]').val()).toBe("Steel Wind");
    expect(JSON.parse($('[name="merits"]').val())).toEqual(["Instructor", "Council", "Medical Officer"]);
    expect($('[name="active"]').is(":checked")).toBe(false);
  },
);
it.each([
  ["Council", " Medical "],
  '["Council"," Medical "]',
  "Council\n Medical ",
])("normalizes merits %j", async (merits) => {
  expect((await post({ ...values, position: "", merits })).statusCode).toBe(
    302,
  );
  expect((await membersRepo.findById(member.id)).merits).toEqual([
    "Council",
    "Medical",
  ]);
});
it("supports repeated multipart merits and checked active", async () => {
  expect(
    (
      await post(
        {
          ...values,
          position: "",
          merits: ["Council", "Medical"],
          active: "on",
        },
        "multipart",
      )
    ).statusCode,
  ).toBe(302);
  expect(await membersRepo.findById(member.id)).toMatchObject({
    merits: ["Council", "Medical"],
    active: true,
  });
});
it("clears merits and optional fields instead of restoring stale data", async () => {
  expect(
    (
      await post({
        circleName: "Steel Wind",
        level: "L2",
        merits: "",
        position: "",
      })
    ).statusCode,
  ).toBe(302);
  expect(await membersRepo.findById(member.id)).toMatchObject({
    merits: [],
    steelRank: "L2",
    circleName: "L2",
    email: "",
    active: false,
  });
});
it("preserves submitted fields and unchecked state after a service failure", async () => {
  const before = structuredClone(await membersRepo.findById(member.id));
  jest
    .spyOn(collectionStore, "saveRecord")
    .mockRejectedValueOnce(new Error("Save unavailable"));
  const response = await post(values, "multipart");
  expect(response.statusCode).toBe(400);
  const $ = load(response.payload);
  expect($(".alert-error").text()).toContain("Save unavailable");
  expect($("form.admin-form").attr("action")).toBe(url());
  for (const [key, value] of Object.entries(values)) {
    if (key !== "merits") expect($(`[name="${key}"]`).val()).toBe(value);
  }
  expect($('[name="merits"]').val()).toBe(values.merits.replace(/\r/g, ""));
  expect($('[name="active"]').is(":checked")).toBe(false);
  expect(response.payload).not.toContain("[object Object]");
  expect(await membersRepo.findById(member.id)).toEqual(before);
  expect((await post(values)).statusCode).toBe(302);
});
it("rejects invalid edits without mutating stored data", async () => {
  const before = structuredClone(await membersRepo.findById(member.id));
  for (const invalid of [
    { circleName: "" },
    { level: "L99" },
    { steelRank: "bad" },
    { circleName: { fields: {} } },
  ]) {
    expect((await post({ ...values, ...invalid })).statusCode).toBe(400);
    expect(await membersRepo.findById(member.id)).toEqual(before);
  }
});
it("returns 404 for missing members", async () => {
  expect(
    (await post(values, "multipart", "/admin/members/missing/edit")).statusCode,
  ).toBe(404);
});
it("keeps failed creates on the create form and shares the same mapping", async () => {
  const failed = await post(
    { ...values, level: "" },
    "multipart",
    "/admin/members",
  );
  expect(failed.statusCode).toBe(400);
  const $ = load(failed.payload);
  expect($("form.admin-form").attr("action")).toBe("/admin/members");
  expect($('[name="circleName"]').val()).toBe("Steel Wind");
  expect($('button[type="submit"]').text()).toBe("Save record");
  const created = await post(values, "multipart", "/admin/members");
  expect(created.statusCode).toBe(302);
  const id = created.headers.location.split("/")[3];
  expect(await membersRepo.findById(id)).toMatchObject({
    position: "Steel Wind",
    merits: ["Instructor", "Council", "Medical Officer"],
    email: values.email,
  });
  await membersRepo.delete(id);
});
it("rolls back the in-memory member when the database write fails", async () => {
  const before = structuredClone(await membersRepo.findById(member.id));
  const db = getDatabase();
  const write = db.write.bind(db);
  jest
    .spyOn(db, "write")
    .mockRejectedValueOnce(new Error("Disk full"));
  const response = await post(values, "multipart");
  expect(response.statusCode).toBe(400);
  expect(load(response.payload)(".alert-error").text()).toContain("Disk full");
  expect(await membersRepo.findById(member.id)).toEqual(before);
  expect((await post(values)).statusCode).toBe(302);
});
