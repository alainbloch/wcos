import { beforeAll, afterAll, it, expect } from "@jest/globals";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import { pagesRepo, updatesRepo } from "../../src/models/database.js";
import { migrateNewsPage } from "../../src/services/newsPageService.js";
let app;
beforeAll(async () => { app = await buildApp(); });
afterAll(async () => app.close());

it("converts the News listing once and keeps its heading and surrounding content", async () => {
  const page = await pagesRepo.findBySlug("news");
  expect(page.dataSources).toContain("newsUpdates");
  expect(page.content).toContain("news-grid");
  expect(load(page.content)("h1").text()).toBe("NEWS");
  const content = page.content;
  expect(migrateNewsPage(page)).toBe(false);
  expect(page.content).toBe(content);
});

it("renders all News records newest first, including a fourth card, without other categories", async () => {
  const items = [];
  try {
    for (let i = 1; i <= 4; i++) {
      items.push(await updatesRepo.create({
        title: "Dynamic news " + i, category: "news", subcategory: "Events",
        date: "2026-05-0" + i, image: "/images/DSC_0550.jpg",
        pageLink: "hello-world", body: "<p>Summary " + i + "</p>",
      }));
    }
    items.push(await updatesRepo.create({title:"Not news", category:"general", date:"2026-06-01", body:"<p>Excluded</p>"}));
    const response = await app.inject("/news");
    expect(response.statusCode).toBe(200);
    const $ = load(response.payload);
    const cards = $(".news-grid .news-card");
    expect(cards.length).toBe(4);
    expect(cards.first().find("h3").text()).toBe("Dynamic news 4");
    expect(cards.last().find("h3").text()).toBe("Dynamic news 1");
    expect(cards.first().find("img").attr("src")).toBe("/images/DSC_0550.jpg");
    expect(cards.first().find(".news-card-readmore").attr("href")).toBe("/hello-world");
    expect(cards.first().find(".news-card-date").text()).toContain("May 4, 2026");
    expect(cards.first().find(".news-card-excerpt").html()).toContain("<p>Summary 4</p>");
    expect($(".news-grid").text()).not.toContain("Not news");
    const css = await app.inject("/css/reference.css");
    expect(css.payload).toContain("repeat(3, minmax(0, 1fr))");
    expect(css.payload).toContain("@media (max-width: 640px)");
  } finally {
    for (const item of items) await updatesRepo.delete(item.id);
  }
});

it("handles empty News and optional fields without broken image or page links", async () => {
  expect((await app.inject("/news")).payload).toContain("No news updates yet.");
  const item = await updatesRepo.create({category:"news",date:"2026-05",body:"<p>Short news</p>"});
  try {
    const $ = load((await app.inject("/news")).payload);
    expect($(".news-card").length).toBe(1);
    expect($(".news-card img, .news-card a").length).toBe(0);
    expect($(".news-card").text()).toContain("Short news");
  } finally { await updatesRepo.delete(item.id); }
});
