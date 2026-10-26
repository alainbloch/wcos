import { ensureReferencePages } from "../../src/services/referenceSiteService.js";
import { beforeAll, afterAll, it, expect } from "@jest/globals";
import { buildApp } from "../../src/app.js";
import { pagesRepo, membersRepo } from "../../src/models/database.js";
let app;
beforeAll(async () => {
  app = await buildApp();
  await ensureReferencePages();
  await app.ready();
});
afterAll(async () => app.close());

it.each([
  ["/?s=steel%20%26%20sword", 302, "/search?q=steel%20%26%20sword"],
  ["/photo-gallery", 302, "https://westerncircle.smugmug.com/"],
  ["/contact-us", 301, "/contact"],
  ["/previous-updates", 301, "/updates"],
  ["/category/events", 302, "/news"],
])("preserves the redirect for %s", async (url, status, location) => {
  const response = await app.inject(url);
  expect(response.statusCode).toBe(status);
  expect(response.headers.location).toBe(location);
});

it("renders search and authentication routes independently of CMS pages", async () => {
  for (const url of ["/search?q=sword", "/login"]) {
    expect((await app.inject(url)).statusCode).toBe(200);
  }
  const response = await app.inject({
    method: "POST",
    url: "/contact",
    payload: { website: "spam" },
  });
  expect(response.statusCode).toBe(400);
  expect(response.json().error).toContain("Unable to send");
});

it("renders member images from the CMS data source without a category controller", async () => {
  const page = await pagesRepo.findBySlug("member-profiles");
  const original = structuredClone(page);
  const member = await membersRepo.create({
    position: "CMS Fighter",
    image: "/uploads/member-example.webp",
    active: true,
  });
  try {
    await pagesRepo.update(page.id, {
      dataSources: ["members"],
      content:
        '{% for member in members %}<img src="{{ member.image }}" alt="{{ member.position }}">{% endfor %}',
    });
    const response = await app.inject("/member-profiles");
    expect(response.statusCode).toBe(200);
    expect(response.payload).toContain('src="/uploads/member-example.webp"');
    expect(response.payload).toContain('alt="CMS Fighter"');
    expect(response.payload).not.toContain("{{ member.image }}");
    await pagesRepo.update(page.id, { published: false });
    expect((await app.inject("/member-profiles")).statusCode).toBe(404);
  } finally {
    await pagesRepo.update(page.id, original);
    await membersRepo.delete(member.id);
  }
});

it("serves a new CMS slug and returns 404 for missing pages", async () => {
  const page = await pagesRepo.create({
    slug: "routing-regression",
    title: "New page",
    content: "<p>Generic route content</p>",
    published: true,
  });
  try {
    const response = await app.inject("/routing-regression");
    expect(response.statusCode).toBe(200);
    expect(response.payload).toContain("Generic route content");
    expect((await app.inject("/missing-routing-regression")).statusCode).toBe(
      404,
    );
  } finally {
    await pagesRepo.delete(page.id);
  }
});

it('renders rank colors before sanitizing styles and removes unsafe rendered HTML', async () => {
  const { load } = await import('cheerio');
  const page = await pagesRepo.findBySlug('member-profiles');
  const created = [];
  try {
    for (const level of ['L7', 'L6', 'L5', 'L4', 'L3', 'L2', 'L1']) {
      created.push(await membersRepo.create({ level, position: `Color ${level}`, active: true,
        biography: '<script>alert(1)</script><img src="/images/test.jpg" onerror="alert(2)"><a href="javascript:alert(3)">Unsafe link</a>' }));
    }
    await pagesRepo.update(page.id, { dataSources: ['members'], content: `
      {% set rankColors = {'L7':'#B8860B','L6':'#333333','L5':'#4A0000','L4':'#CC0000','L3':'#777777','L2':'#002600','L1':'#000000'} %}
      {% for member in members %}
      {% set rankColor = rankColors[member.level] or '#000000' %}
      <div data-test-member="{{ member.id }}" style="border-left-color: {{ rankColor }}; position:fixed;">{{ member.level }}{{ member.biography | safe }}</div>
      {% endfor %}` });
    const response = await app.inject('/member-profiles');
    expect(response.statusCode).toBe(200);
    const $ = load(response.payload);
    const colors = ['#B8860B','#333333','#4A0000','#CC0000','#777777','#002600','#000000'];
    for (const [index, member] of created.entries()) {
      const panel = $(`[data-test-member="${member.id}"]`);
      expect(panel.attr('style')).toBe(`border-left-color:${colors[index]}`);
      expect(panel.find('script,[onerror],a[href^="javascript:"]').length).toBe(0);
    }
  } finally {
    await pagesRepo.update(page.id, page);
    for (const member of created) await membersRepo.delete(member.id);
  }
});
