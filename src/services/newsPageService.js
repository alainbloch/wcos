import fs from "node:fs";
import { load } from "cheerio";

export const newsCardsTemplate = fs.readFileSync(
  new URL("../content/news-cards.njk", import.meta.url), "utf8",
);

// Replace only the legacy News listing; retain the editor's heading and surrounding content.
// Once converted, subsequent starts leave the editable template alone.
export function migrateNewsPage(page) {
  if (!page || page.slug !== "news" || page.content?.includes("newsUpdates")) return false;
  const $ = load(page.content || "", {}, false);
  const listing = $(".jkit-posts");
  if (!listing.length) return false;
  listing.first().replaceWith('<div id="dynamic-news-placeholder"></div>');
  page.content = $.html().replace('<div id="dynamic-news-placeholder"></div>', newsCardsTemplate);
  page.dataSources = [...new Set([...(page.dataSources || []), "newsUpdates"])];
  return true;
}
