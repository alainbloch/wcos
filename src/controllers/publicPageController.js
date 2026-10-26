import { BaseController } from "./baseController.js";
import {
  getPublicPage,
  originalPages,
  sanitizePageContent,
} from "../services/referenceSiteService.js";
import { dynamicPageService } from "../services/dynamicPageService.js";

/** All public controllers share the restored layout, CSS metadata and publication rules. */
export class PublicPageController extends BaseController {
  async renderPage(request, reply, slug) {
    const page = await getPublicPage(slug);
    if (!page) return this.notFound(request, reply);

    let dynamicContent = page.content || "";
    let dynamicData = {};

    // If dataSources set, resolve data and render page content through Nunjucks
    if (page.dataSources && page.dataSources.length > 0) {
      dynamicData = await dynamicPageService.resolveDataSources(page.dataSources);
      if (typeof dynamicContent === "string" && dynamicContent.trim()) {
        try {
          const contentRendered = await new Promise((resolve, reject) => {
            request.server.nunjucks.renderString(dynamicContent, dynamicData, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
          dynamicContent = contentRendered;
        } catch (e) {
          // If content isn't a valid template, leave it as-is
        }
      }
    }

    // Sanitize rendered values too, including HTML emitted by safe filters.
    dynamicContent = sanitizePageContent(dynamicContent);

    const preparedPage = { ...page, ...dynamicData, content: dynamicContent };

    return this.render(request, reply, "pages/reference.njk", {
      page: preparedPage,
      pageTitle: page.title,
      ...dynamicData,
    });
  }

  async notFound(request, reply) {
    reply.code(404);
    return this.render(request, reply, "pages/not-found.njk", {
      page: originalPages.find((page) => page.slug === ""),
      pageTitle: "Page not found",
    });
  }
}
