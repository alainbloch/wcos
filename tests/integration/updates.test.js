import { beforeAll, afterAll, it, expect } from "@jest/globals";
import fs from "node:fs";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import {
  usersRepo,
  updatesRepo,
  pagesRepo,
  getDatabase,
  initDatabase,
} from "../../src/models/database.js";
import { authService } from "../../src/services/authService.js";
import { updatesService } from "../../src/services/updatesService.js";
import {
  updatesSeed,
  seedUpdates,
} from "../../src/models/migrations/seedUpdates.js";
let app, cookie, csrf;
beforeAll(async () => {
  app = await buildApp();
  cookie = `wcos_session=${authService.generateToken(await usersRepo.findByEmail("admin@wcos.org"))}`;
  const response = await app.inject({
    url: "/admin/updates/new",
    headers: { cookie },
  });
  csrf = load(response.payload)('[name="_csrf"]').val();
  cookie += `; sessionId=${response.cookies.find((c) => c.name === "sessionId").value}`;
});
afterAll(async () => app.close());
const post = (url, payload = {}) =>
  app.inject({
    method: "POST",
    url,
    headers: { cookie },
    payload: { _csrf: csrf, ...payload },
  });
it("imports all entries and preserves partial dates and HTML", async () => {
  expect((await updatesService.getAll("general")).length).toBe(157);
  expect((await updatesService.getAll("council")).length).toBe(7);
  const feb = (await updatesService.getAll()).find((x) => x.date === "2008-02");
  expect(feb.dateLabel).toBe("February 2008");
  expect(feb.body).toContain("<a href=");
  const copy = structuredClone(getDatabase().data);
  const length = copy.updates.length;
  seedUpdates(copy);
  expect(copy.updates.length).toBe(length);
});
it("requires authentication and CSRF protection", async () => {
  expect((await app.inject("/admin/updates")).statusCode).toBe(401);
  expect((await post("/admin/updates", { _csrf: "" })).statusCode).toBe(403);
});
it("creates, edits, filters, previews and deletes updates", async () => {
  const fields = {
    title: "Test update",
    date: "2026-10-24",
    category: "general",
    content: "<p>New <strong>update</strong></p><script>alert(1)</script>",
  };
  const created = await post("/admin/updates", fields);
  expect(created.statusCode).toBe(302);
  const item = (await updatesRepo.findAll()).find(
    (x) => x.title === fields.title,
  );
  expect(item.body).not.toContain("<script");
  let response = await app.inject({
    url: created.headers.location,
    headers: { cookie },
  });
  expect(load(response.payload)('textarea[name="content"]').val()).toBe(
    item.body,
  );
  expect(
    (
      await post(created.headers.location, {
        ...fields,
        title: "",
        date: "2026-09",
        category: "council",
      })
    ).statusCode,
  ).toBe(302);
  expect((await updatesRepo.findById(item.id)).dateLabel).toBe(
    "September 2026",
  );
  expect(
    (await updatesService.getAll("general")).some((x) => x.id === item.id),
  ).toBe(false);
  response = await app.inject({
    url: "/admin/updates?category=council",
    headers: { cookie },
  });
  expect(response.payload).toContain(`/admin/updates/${item.id}/edit`);
  response = await post("/admin/updates/preview", {
    content: "<p>Unsaved preview</p>",
  });
  expect(response.statusCode).toBe(200);
  expect(response.payload).toContain("Unsaved preview");
  expect((await post(`/admin/updates/${item.id}/delete`)).statusCode).toBe(302);
  expect(await updatesRepo.findById(item.id)).toBeNull();
});
it("rejects impossible dates and invalid categories without losing form content", async () => {
  for (const fields of [
    { date: "2025-02-29", category: "general" },
    { date: "2024-13", category: "general" },
    { date: "2024-02-29", category: "invalid" },
  ]) {
    const r = await post("/admin/updates", {
      ...fields,
      title: "Keep title",
      content: "<p>Keep body</p>",
    });
    expect(r.statusCode).toBe(400);
    const $ = load(r.payload);
    expect($("#title").val()).toBe("Keep title");
    expect($("textarea").val()).toBe("<p>Keep body</p>");
  }
  expect((await post("/admin/updates/missing/edit", {})).statusCode).toBe(404);
});
it("renders each template with only its category and preserves council member markup", async () => {
  for (const [slug, file, sources, category] of [
    ["updates", "updates.html", ["generalUpdates"], "general"],
    [
      "wcos-council",
      "wcos-council-updates.html",
      ["councilUpdates", "members"],
      "council",
    ],
  ]) {
    const page = await pagesRepo.findBySlug(slug);
    const original = structuredClone(page);
    try {
      const content = fs.readFileSync(
        new URL("../../docs/cms/" + file, import.meta.url),
        "utf8",
      );
      await pagesRepo.update(page.id, { content, dataSources: sources });
      const response = await app.inject("/" + slug);
      expect(response.statusCode).toBe(200);
      const $ = load(response.payload);
      const records = await updatesService.getAll(category);
      expect(
        category === "general"
          ? $("h4").length
          : $("details.reference-accordion").length,
      ).toBe(records.length);
      expect(response.payload).toContain(records[0].dateLabel);
      expect(response.payload).not.toContain("{% for update");
      if (category === "council") {
        expect($(".card-header-button .title").first().text()).toContain(
          records[0].dateLabel,
        );
        expect($(".card-expand .card-body").length).toBe(7);
        expect(content).toContain("currentCouncilMembers");
      }
    } finally {
      await pagesRepo.update(page.id, original);
    }
  }
});
it("does not reimport edited or deleted seed entries on restart", async () => {
  const original = (await updatesRepo.findAll())[0];
  await updatesRepo.update(original.id, { title: "Edited seed" });
  const removed = (await updatesRepo.findAll())[1];
  await updatesRepo.delete(removed.id);
  await initDatabase();
  expect((await updatesRepo.findById(original.id)).title).toBe("Edited seed");
  expect(await updatesRepo.findById(removed.id)).toBeNull();
});

const multipartPost = async (url, fields, image, filename = "photo.png") => {
  const boundary = "update-form-boundary";
  const chunks = [];
  for (const [name, value] of Object.entries({ _csrf: csrf, ...fields })) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  if (image !== undefined) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`), image, Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return app.inject({
    method: "POST", url,
    headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat(chunks),
  });
};

it("saves multipart updates with images and preserves images when no replacement is selected", async () => {
  const sharp = (await import("sharp")).default;
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
  const fields = { title: "Multipart news", date: "2026-10-24", category: "news", subcategory: "Events", pageLink: "updates", content: "<p>News summary</p>" };
  const created = await multipartPost("/admin/updates", fields, image);
  expect(created.statusCode).toBe(302);
  const item = (await updatesRepo.findAll()).find(x => x.title === fields.title);
  expect(item).toMatchObject({ title: fields.title, category: "news", subcategory: "Events", pageLink: "updates", body: fields.content });
  expect(item.image).toMatch(/^\/uploads\/update-.*\.webp$/);
  expect((await app.inject(item.image)).statusCode).toBe(200);
  const edited = await multipartPost(created.headers.location, { ...fields, title: "Edited multipart" }, Buffer.alloc(0), "");
  expect(edited.statusCode).toBe(302);
  expect(await updatesRepo.findById(item.id)).toMatchObject({ title: "Edited multipart", image: item.image });
  expect((await multipartPost(created.headers.location, fields)).statusCode).toBe(302);
  expect((await updatesRepo.findById(item.id)).image).toBe(item.image);

  const config = (await import("../../src/config/index.js")).default;
  const before = fs.readdirSync(config.uploadDir).sort();
  const invalid = await multipartPost(created.headers.location, { ...fields, date: "invalid" }, image);
  expect(invalid.statusCode).toBe(400);
  const $ = load(invalid.payload);
  expect($("#title").val()).toBe(fields.title);
  expect($("#content").val()).toBe(fields.content);
  expect(invalid.payload).toContain(item.image);
  expect(fs.readdirSync(config.uploadDir).sort()).toEqual(before);
  expect((await updatesRepo.findById(item.id)).title).toBe("Multipart news");
  expect((await multipartPost(created.headers.location, fields, Buffer.from("not an image"))).statusCode).toBe(400);
  expect((await updatesRepo.findById(item.id)).image).toBe(item.image);
  expect((await multipartPost(created.headers.location, { ...fields, _csrf: "" }, image)).statusCode).toBe(403);
  expect(fs.readdirSync(config.uploadDir).sort()).toEqual(before);
  expect((await multipartPost(created.headers.location, fields, image)).statusCode).toBe(302);
  const replaced = await updatesRepo.findById(item.id);
  expect(replaced.image).not.toBe(item.image);
  expect((await app.inject(replaced.image)).statusCode).toBe(200);
});

it("creates multipart updates with an empty image picker", async () => {
  const response = await multipartPost("/admin/updates", { title: "No image", date: "2026-10", category: "general", content: "<p>Body</p>" }, Buffer.alloc(0), "");
  expect(response.statusCode).toBe(302);
  expect((await updatesRepo.findAll()).find(x => x.title === "No image").image).toBe("");
});
