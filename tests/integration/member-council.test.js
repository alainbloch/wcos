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
  pagesRepo,
} from "../../src/models/database.js";
import { memberService } from "../../src/services/memberService.js";
import { authService } from "../../src/services/authService.js";
import { dynamicPageService } from "../../src/services/dynamicPageService.js";
let app, cookie;
const ids = [];
const fields = {
  circleName: "Council Person",
  level: "L4",
  councilPosition: "Secretary",
  councilTitle: "Kaiden",
  councilTermStart: "January 2024",
  councilTermEnd: "",
  councilHistoricalDate: "2024-01-01",
  councilCurrent: "on",
  active: "on",
  biography: "Shared biography",
};
beforeAll(async () => {
  app = await buildApp();
  cookie = `wcos_session=${authService.generateToken(await usersRepo.findByEmail("admin@wcos.org"))}`;
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  for (const id of ids) await membersRepo.delete(id);
  await app.close();
});
const get = (url) => app.inject({ url, headers: { cookie } });
const post = (url, values) =>
  app.inject({
    method: "POST",
    url,
    headers: {
      cookie,
      "content-type": "multipart/form-data; boundary=council-fields",
    },
    payload:
      Object.entries(values)
        .filter(([, value]) => value !== undefined)
        .map(
          ([name, value]) =>
            `--council-fields\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        )
        .join("") + "--council-fields--\r\n",
  });
it("creates and updates council details on the member form including checkbox clearing", async () => {
  const response = await post("/admin/members", fields);
  expect(response.statusCode).toBe(302);
  const id = response.headers.location.split("/")[3];
  ids.push(id);
  expect(await membersRepo.findById(id)).toMatchObject({
    councilPosition: "Secretary",
    councilCurrent: true,
    biography: "Shared biography",
    position: "Council Person",
  });
  const $ = load((await get(response.headers.location)).payload);
  expect($("legend").text()).toContain("Council Service");
  expect($("[name=councilTermStart]").val()).toBe("January 2024");
  expect($("[name=councilCurrent]").is(":checked")).toBe(true);
  expect(
    (
      await post(response.headers.location, {
        ...fields,
        councilCurrent: undefined,
        councilTermEnd: "2025",
      })
    ).statusCode,
  ).toBe(302);
  expect(await membersRepo.findById(id)).toMatchObject({
    councilCurrent: false,
    councilTermEnd: "2025",
  });
});
it("preserves council edits after validation or storage failure without changing the record", async () => {
  const id = ids[0];
  const before = structuredClone(await membersRepo.findById(id));
  jest
    .spyOn(memberService, "updateMember")
    .mockRejectedValueOnce(new Error("Write failed"));
  for (const values of [fields, { ...fields, level: "" }]) {
    const response = await post(`/admin/members/${id}/edit`, values);
    expect(response.statusCode).toBe(400);
    const $ = load(response.payload);
    expect($("[name=councilPosition]").val()).toBe("Secretary");
    expect($("[name=councilCurrent]").is(":checked")).toBe(true);
    expect(await membersRepo.findById(id)).toEqual(before);
  }
});
it("filters admin lists, repositories, and page data consistently", async () => {
  const current = await membersRepo.create({
    position: "Current Person",
    councilCurrent: true,
    active: false,
  });
  ids.push(current.id);
  const ordinary = await membersRepo.create({
    position: "Ordinary Person",
    active: true,
  });
  ids.push(ordinary.id);
  const all = load((await get("/admin/members?council=all")).payload);
  expect(all("table").text()).toContain("Council Person");
  expect(all("table").text()).toContain("Current Person");
  expect(all("table").text()).not.toContain("Ordinary Person");
  const now = load((await get("/admin/members?council=current")).payload);
  expect(now("table").text()).toContain("Current Person");
  expect(now("table").text()).not.toContain("Council Person");
  const data = await dynamicPageService.resolveDataSources([
    "members",
    "councilMembers",
    "currentCouncilMembers",
  ]);
  expect(data.councilMembers.map((m) => m.id)).toEqual([ids[0], current.id]);
  expect(data.currentCouncilMembers.map((m) => m.id)).toEqual([current.id]);
  expect(await membersRepo.findCurrentCouncilMembers()).toEqual(
    data.currentCouncilMembers,
  );
  expect((await get("/admin/council")).statusCode).toBe(404);
  expect(all('a[href="/admin/council"]').length).toBe(0);
});
it("renders council filters inside CMS content from the members data source", async () => {
  const page = await pagesRepo.create({
    slug: "council-filter-test",
    title: "Council",
    published: true,
    dataSources: ["members"],
    content:
      '<section id="all">{% for member in members | councilMembers %}<p>{{ member.position }}</p>{% endfor %}</section><section id="current">{% for member in members | currentCouncilMembers %}<p>{{ member.position }}</p>{% endfor %}</section>',
  });
  try {
    const response = await app.inject("/council-filter-test");
    expect(response.statusCode).toBe(200);
    const $ = load(response.payload);
    expect($("#all").text()).toContain("Council Person");
    expect($("#all").text()).toContain("Current Person");
    expect($("#current").text()).toBe("Current Person");
  } finally {
    await pagesRepo.delete(page.id);
  }
});
