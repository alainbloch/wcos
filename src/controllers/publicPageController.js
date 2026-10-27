import { renderPageContent } from "../services/pageRenderingService.js";
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

    let rendered;
    try {
      rendered = await renderPageContent(request.server, page, request.query);
    } catch (error) {
      return reply
        .code(400)
        .type("text/plain")
        .send("Invalid data view request.");
    }
    const { content: dynamicContent, dynamicData } = rendered;

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
