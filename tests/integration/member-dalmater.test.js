import { beforeAll, afterAll, it, expect } from "@jest/globals";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import { membersRepo, usersRepo } from "../../src/models/database.js";
import { authService } from "../../src/services/authService.js";
let app, cookie, teacher, student, other;
beforeAll(async () => {
  app = await buildApp();
  cookie = `wcos_session=${authService.generateToken(await usersRepo.findByEmail("admin@wcos.org"))}`;
  teacher = await membersRepo.create({
    position: "Teacher",
    merits: ["Kaiden"],
    dalmaterColorName: "Jade",
    dalmaterColorHex: "#00FF00",
    dalmaterMode: "custom",
  });
  other = await membersRepo.create({
    position: "Not a Kaiden",
    merits: [],
    dalmaterColorName: "Red",
    dalmaterColorHex: "#FF0000",
  });
  student = await membersRepo.create({ position: "Student", level: "L3" });
});
afterAll(async () => {
  for (const m of [teacher, student, other]) await membersRepo.delete(m.id);
  await app.close();
});
const url = () => `/admin/members/${student.id}/edit`;
const get = (url) => app.inject({ url, headers: { cookie } });
function post(values) {
  const payload = { circleName: "Student", level: "L3", ...values };
  return app.inject({
    method: "POST",
    url: url(),
    headers: { cookie, "content-type": "multipart/form-data; boundary=colors" },
    payload:
      Object.entries(payload)
        .map(
          ([name, value]) =>
            `--colors\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        )
        .join("") + "--colors--\r\n",
  });
}
it("offers only Kaiden colors and saves a validated color snapshot", async () => {
  let $ = load((await get(url())).payload);
  expect(
    $(`[name=dalmaterKaidenId] option[value="${teacher.id}"]`).length,
  ).toBe(1);
  expect($(`[name=dalmaterKaidenId] option[value="${other.id}"]`).length).toBe(
    0,
  );
  expect(
    (
      await post({
        dalmaterMode: "kaiden",
        dalmaterKaidenId: teacher.id,
        dalmaterColorHex: "bad",
      })
    ).statusCode,
  ).toBe(302);
  expect(await membersRepo.findById(student.id)).toMatchObject({
    dalmaterMode: "kaiden",
    dalmaterColorName: "Jade",
    dalmaterColorHex: "#00FF00",
  });
  await membersRepo.update(teacher.id, { dalmaterColorHex: "#112233" });
  expect((await membersRepo.findById(student.id)).dalmaterColorHex).toBe(
    "#00FF00",
  );
});
it("preserves invalid custom values and reloads the dropdown without corrupting the record", async () => {
  const before = structuredClone(await membersRepo.findById(student.id));
  const response = await post({
    dalmaterMode: "custom",
    dalmaterColorName: "My color",
    dalmaterColorHex: "not-hex",
  });
  expect(response.statusCode).toBe(400);
  const $ = load(response.payload);
  expect($("[name=dalmaterColorHex]").val()).toBe("not-hex");
  expect($("[name=dalmaterColorName]").val()).toBe("My color");
  expect(
    $(`[name=dalmaterKaidenId] option[value="${teacher.id}"]`).length,
  ).toBe(1);
  expect(await membersRepo.findById(student.id)).toEqual(before);
  expect(
    (await post({ dalmaterMode: "kaiden", dalmaterKaidenId: other.id }))
      .statusCode,
  ).toBe(400);
});
it("switches to custom color and clears the assignment explicitly", async () => {
  expect(
    (
      await post({
        dalmaterMode: "custom",
        dalmaterColorName: " My color ",
        dalmaterColorHex: "#abc",
      })
    ).statusCode,
  ).toBe(302);
  expect(await membersRepo.findById(student.id)).toMatchObject({
    dalmaterColorName: "My color",
    dalmaterColorHex: "#AABBCC",
    dalmaterKaidenId: "",
  });
  const $ = load((await get(url())).payload);
  expect($("[name=dalmaterMode]").val()).toBe("custom");
  expect((await post({ dalmaterMode: "" })).statusCode).toBe(302);
  expect((await membersRepo.findById(student.id)).dalmaterColorName).toBe("");
  expect((await get("/admin/dalmater-colors")).statusCode).toBe(404);
});
