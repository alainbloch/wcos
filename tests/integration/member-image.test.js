import {
  beforeAll,
  afterAll,
  afterEach,
  it,
  expect,
  jest,
} from "@jest/globals";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import config from "../../src/config/index.js";
import { membersRepo, usersRepo } from "../../src/models/database.js";
import { memberService } from "../../src/services/memberService.js";
import { authService } from "../../src/services/authService.js";
let app, cookie, member, png, directory;
const originalDir = config.uploadDir;
const originalMaxFileSize = config.maxFileSize;
beforeAll(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "wcos-images-"));
  config.uploadDir = directory;
  config.maxFileSize = 4096;
  app = await buildApp();
  cookie = `wcos_session=${authService.generateToken(await usersRepo.findByEmail("admin@wcos.org"))}`;
  member = await membersRepo.create({
    position: "Wind",
    level: "L3",
    image: "/images/original.jpg",
  });
  png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await membersRepo.delete(member.id);
  await app.close();
  config.uploadDir = originalDir;
  config.maxFileSize = originalMaxFileSize;
  await rm(directory, { recursive: true, force: true });
});
function submit({
  bytes,
  filename = "portrait.png",
  fields = {},
  auth = true,
  create = false,
} = {}) {
  const boundary = "member-image-test";
  const parts = Object.entries({
    circleName: "Wind",
    level: "L3",
    merits: "Council",
    ...fields,
  }).map(([name, value]) =>
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ),
  );
  if (bytes !== undefined)
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      bytes,
      Buffer.from("\r\n"),
    );
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return app.inject({
    method: "POST",
    url: create ? "/admin/members" : `/admin/members/${member.id}/edit`,
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      ...(auth ? { cookie } : {}),
    },
    payload: Buffer.concat(parts),
  });
}
it("renders a multipart file picker with the existing preview", async () => {
  const response = await app.inject({
    url: `/admin/members/${member.id}/edit`,
    headers: { cookie },
  });
  const $ = load(response.payload);
  expect($("form.admin-form").attr("enctype")).toBe("multipart/form-data");
  expect($('[name="image"]').attr("type")).toBe("file");
  expect($(".image-preview img").attr("src")).toBe("/images/original.jpg");
});
it("uploads, decodes, and serves an image immediately", async () => {
  expect((await submit({ bytes: png })).statusCode).toBe(302);
  const saved = await membersRepo.findById(member.id);
  expect(saved.image).toMatch(/^\/uploads\/member-[a-f0-9-]+\.webp$/);
  expect(saved.merits).toEqual(["Council"]);
  const response = await app.inject(saved.image);
  expect(response.statusCode).toBe(200);
  expect((await sharp(response.rawPayload).metadata()).format).toBe("webp");
});
it("preserves the image when no file is selected", async () => {
  const image = (await membersRepo.findById(member.id)).image;
  expect((await submit()).statusCode).toBe(302);
  expect(
    (await submit({ bytes: Buffer.alloc(0), filename: "" })).statusCode,
  ).toBe(302);
  expect((await membersRepo.findById(member.id)).image).toBe(image);
});
it("rejects disguised non-images and preserves the form and current image", async () => {
  const image = (await membersRepo.findById(member.id)).image;
  const response = await submit({
    bytes: Buffer.from("<script>bad()</script>"),
    fields: { circleName: "Unsaved name" },
  });
  expect(response.statusCode).toBe(400);
  const $ = load(response.payload);
  expect($('[name="circleName"]').val()).toBe("Unsaved name");
  expect($(".image-preview img").attr("src")).toBe(image);
  expect($(".alert-error").text()).toContain("valid JPEG");
  expect((await membersRepo.findById(member.id)).position).toBe("Wind");
});
it("cleans up a new upload if saving the member fails", async () => {
  const files = await readdir(directory);
  const image = (await membersRepo.findById(member.id)).image;
  jest
    .spyOn(memberService, "updateMember")
    .mockRejectedValueOnce(new Error("Save failed"));
  expect((await submit({ bytes: png })).statusCode).toBe(400);
  expect(await readdir(directory)).toEqual(files);
  expect((await membersRepo.findById(member.id)).image).toBe(image);
});
it("validates fields before storing files and requires authentication", async () => {
  const files = await readdir(directory);
  expect((await submit({ bytes: png, fields: { level: "" } })).statusCode).toBe(
    400,
  );
  expect((await submit({ bytes: png, auth: false })).statusCode).toBe(401);
  expect(await readdir(directory)).toEqual(files);
});
it("supports uploading while creating a member", async () => {
  const response = await submit({ bytes: png, create: true });
  expect(response.statusCode).toBe(302);
  const id = response.headers.location.split("/")[3];
  expect((await membersRepo.findById(id)).image).toMatch(/^\/uploads\/member-/);
  await membersRepo.delete(id);
});

it("rejects oversized uploads without changing the member or storing a file", async () => {
  const files = await readdir(directory);
  const before = structuredClone(await membersRepo.findById(member.id));
  expect((await submit({ bytes: Buffer.alloc(4097) })).statusCode).toBe(413);
  expect(await membersRepo.findById(member.id)).toEqual(before);
  expect(await readdir(directory)).toEqual(files);
});
