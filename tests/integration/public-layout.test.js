import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { load } from "cheerio";
import fs from "node:fs";
import { buildApp } from "../../src/app.js";
import { originalPages } from "../../src/services/referenceSiteService.js";
import {
  pagesRepo,
  membersRepo,
  usersRepo,
  getDatabase,
} from "../../src/models/database.js";
import { authService } from "../../src/services/authService.js";

let app, cookie;
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  cookie = `wcos_session=${authService.generateToken(await usersRepo.findByEmail("admin@wcos.org"))}`;
});
afterAll(async () => app.close());
const post = (url, payload) =>
  app.inject({ method: "POST", url, payload, headers: { cookie } });

describe("One public layout through category controllers", () => {
  it.each(originalPages.map((page) => [page.slug]))(
    "honors CMS edits and publication for /%s",
    async (slug) => {
      const page = await pagesRepo.findBySlug(slug);
      const saved = { ...page };
      try {
        await pagesRepo.update(page.id, {
          content: "<h1>Edited through the CMS</h1><p>Canonical page body.</p>",
        });
        const response = await app.inject("/" + slug);
        expect(response.statusCode).toBe(200);
        expect(response.payload).toContain("Canonical page body.");
        expect(response.payload).not.toContain("/css/main.css");
        await pagesRepo.update(page.id, { published: false });
        expect((await app.inject("/" + slug)).statusCode).toBe(404);
      } finally {
        await pagesRepo.update(page.id, saved);
      }
    },
  );

  it("removes the legacy public shell, assets and sample page templates", () => {
    for (const path of [
      "src/views/layouts/base.njk",
      "src/views/partials/header.njk",
      "src/views/partials/footer.njk",
      "public/css/main.css",
      "public/js/main.js",
      "src/views/pages/home.njk",
    ])
      expect(fs.existsSync(path)).toBe(false);
    expect(
      fs
        .readdirSync("src/views/pages", { recursive: true })
        .filter((path) => path.endsWith(".njk"))
        .sort(),
    ).toEqual(["not-found.njk", "reference.njk", "search.njk"]);
  });

  it("retains working member CRUD inside the restored styled roster", async () => {
    const page = await pagesRepo.findBySlug("member-profiles");
    const saved = { ...page };
    const db = getDatabase();
    const savedMembers = structuredClone(db.data.members);
    const savedManaged = db.data.memberRosterManaged;
    db.data.members = [];
    delete db.data.memberRosterManaged;
    await db.write();
    try {
      const original = await app.inject("/member-profiles");
      const originalDom = load(original.payload);
      originalDom("#content .table-row")
        .not("#list-header")
        .each((_, row) => {
          const id = originalDom(row).attr("data-member-dialog");
          expect(id).toBeTruthy();
          expect(originalDom(`dialog[id="${id}"]`).length).toBe(1);
        });
      expect(
        load(original.payload)("#content .table-row").length,
      ).toBeGreaterThan(10);
      await pagesRepo.update(page.id, {
        content:
          '<p id="cms-introduction">Managed member introduction</p>' +
          page.content,
      });
      const fields = {
        level: "L7",
        steelRank: "L6",
        circleName: "Gad",
        merits: "Expert Swordsman\nHead Kaiden",
        memberSince: "Aug 1982",
        region: "Hayward, CA",
        biography: "<script>unsafe()</script>",
        yearsFought: "30",
        weaponType: "Longsword",
        email: "member@example.org",
        active: "on",
      };
      const created = await post("/admin/members", fields);
      expect(created.statusCode).toBe(302);
      const member = (await membersRepo.findAll())[0];
      const response = await app.inject("/member-profiles");
      const $ = load(response.payload);
      expect($("#cms-introduction").text()).toBe("Managed member introduction");
      expect($("#content .table-row").length).toBe(2);
      expect($("#member-gad").is("dialog")).toBe(true);
      expect($("#member-gad").text()).toContain("Longsword");
      expect($('#member-gad a[href="mailto:member@example.org"]').length).toBe(
        1,
      );
      expect($("[data-member-id]").attr("role")).toBe("button");
      expect($("[data-member-id]").attr("tabindex")).toBe("0");
      const columns = $(`[data-member-id="${member.id}"]`).children();
      expect(columns.length).toBe(6);
      expect(columns.eq(2).text()).toContain("Gad");
      expect(columns.eq(3).text()).toContain("Head Kaiden");
      expect(columns.eq(1).find("img").attr("src")).toBe(
        "/images/gadthumb.jpg",
      );
      expect(response.payload).not.toContain("<script>unsafe()");
      expect($(' [data-member-dialog="member-gad"]').length).toBeGreaterThan(0);
      for (const css of page.styles)
        expect($(`link[href="${css}"]`).length).toBeGreaterThan(0);
      const editForm = await app.inject({
        url: `/admin/members/${member.id}/edit`,
        headers: { cookie },
      });
      expect(editForm.statusCode).toBe(200);
      expect(load(editForm.payload)("[name=circleName]").val()).toBe("Gad");
      await post(`/admin/members/${member.id}/edit`, {
        ...fields,
        circleName: "Changed name",
        active: undefined,
      });
      expect((await app.inject("/member-profiles")).payload).toContain(
        "No active members to display.",
      );
      await post(`/admin/members/${member.id}/edit`, {
        ...fields,
        circleName: "Changed name",
      });
      expect((await app.inject("/member-profiles")).payload).toContain(
        "Changed name",
      );
      expect(
        (await post(`/admin/members/${member.id}/delete`, {})).statusCode,
      ).toBe(302);
      const empty = load((await app.inject("/member-profiles")).payload);
      expect(empty(".member-empty").text()).toContain("No active members");
      expect(empty("#content .table-row").length).toBe(1);
    } finally {
      await pagesRepo.update(page.id, saved);
      db.data.members = savedMembers;
      if (savedManaged === undefined) delete db.data.memberRosterManaged;
      else db.data.memberRosterManaged = savedManaged;
      await db.write();
    }
  });
});
