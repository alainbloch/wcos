import { BaseController } from "./baseController.js";
import {
  getPublicPage,
  originalPages,
} from "../services/referenceSiteService.js";
import { dynamicPageService } from "../services/dynamicPageService.js";

/** All public controllers share the restored layout, CSS metadata and publication rules. */
export class PublicPageController extends BaseController {
  async renderPage(request, reply, slug, preparePage = (page) => page) {
    const page = await getPublicPage(slug);
    if (!page) return this.notFound(request, reply);

    let dynamicContent = page.content || "";
    let dynamicData = {};

    if (page.dataSources && page.dataSources.length > 0) {
      dynamicData = await dynamicPageService.resolveDataSources(page.dataSources);
    }

    if (page.templatePartial) {
      const partialHtml = await dynamicPageService.renderPartial(
        request.server,
        page.templatePartial,
        page.dataSources || [],
      );
      if (partialHtml !== null) {
        dynamicContent = partialHtml;
      }
    }

    const preparedPage = await preparePage({ ...page, ...dynamicData, content: dynamicContent });

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
