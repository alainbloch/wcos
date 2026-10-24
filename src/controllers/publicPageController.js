import { BaseController } from "./baseController.js";
import {
  getPublicPage,
  originalPages,
} from "../services/referenceSiteService.js";

/** All public controllers share the restored layout, CSS metadata and publication rules. */
export class PublicPageController extends BaseController {
  async renderPage(request, reply, slug, preparePage = (page) => page) {
    const page = await getPublicPage(slug);
    if (!page) return this.notFound(request, reply);
    return this.render(request, reply, "pages/reference.njk", {
      page: await preparePage(page),
      pageTitle: page.title,
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
