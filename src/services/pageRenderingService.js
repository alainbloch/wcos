import { dynamicPageService } from "./dynamicPageService.js";
import { sanitizePageContent } from "./referenceSiteService.js";
/** Public pages and unsaved previews deliberately use the same data and presentation pipeline. */
export async function renderPageContent(server, page, query = {}) {
  // Collection-backed data sources win: relationship fields resolve the selected records,
  // superseding any legacy resolver of the same name. Remaining names come from dataSources.
  const relationships = await dynamicPageService.resolveRelationships(page);
  const dynamicData = {
    ...(await dynamicPageService.resolveDataSources(
      page.dataSources || [],
      query,
    )),
    ...relationships,
  };
  let content = page.content || "";
  if (Object.keys(dynamicData).length && content.trim()) {
    try {
      content = await new Promise((resolve, reject) =>
        server.nunjucks.renderString(content, dynamicData, (error, html) =>
          error ? reject(error) : resolve(html),
        ),
      );
    } catch {
      /* Preserve legacy pages with literal template syntax. */
    }
  }
  content = sanitizePageContent(content);
  return { content, dynamicData };
}
