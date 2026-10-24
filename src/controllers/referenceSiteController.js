import { BaseController } from "./baseController.js";
import {
  getPublicPage,
  searchPages,
  originalPages,
} from "../services/referenceSiteService.js";

class ReferenceSiteController extends BaseController {
  async page(request, reply) {
    const slug = request.params.slug || "";
    if (!slug && request.query.s)
      return reply.redirect(`/search?q=${encodeURIComponent(request.query.s)}`);
    const page = await getPublicPage(slug);
    if (!page) return this.notFound(request, reply);
    return this.render(request, reply, "pages/reference.njk", {
      page,
      pageTitle: page.title,
    });
  }
  async search(request, reply) {
    const query = String(request.query.q || "").slice(0, 200);
    return this.render(request, reply, "pages/search.njk", {
      page: originalPages.find((p) => p.slug === ""),
      pageTitle: "Search",
      query,
      results: await searchPages(query),
    });
  }
  async notFound(request, reply) {
    reply.code(404);
    return this.render(request, reply, "pages/not-found.njk", {
      page: originalPages.find((p) => p.slug === ""),
      pageTitle: "Page not found",
    });
  }
}
export const referenceSiteController = new ReferenceSiteController();
