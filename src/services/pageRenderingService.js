import { dynamicPageService } from "./dynamicPageService.js";
import { sanitizePageContent } from "./referenceSiteService.js";
import { renderDataView } from "./collections/render.js";
/** Public pages and unsaved previews deliberately use the same data and presentation pipeline. */
export async function renderPageContent(server, page, query = {}) {
  const dynamicData = await dynamicPageService.resolveDataSources(
    page.dataSources || [],
    query,
  );
  let content = page.content || "";
  if (page.dataSources?.length && content.trim()) {
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
  if (page.dataView) content += renderDataView(page.dataView, query);
  return { content, dynamicData };
}
