import { PublicPageController } from "./publicPageController.js";
import {
  searchPages,
  originalPages,
} from "../services/referenceSiteService.js";

/** Dynamic CMS pages use exactly the same rendering path as named category routes. */
class ReferenceSiteController extends PublicPageController {
  async page(request, reply) {
    return this.renderPage(request, reply, request.params.slug || "");
  }

  async search(request, reply) {
    const query = String(request.query.q || "").slice(0, 200);
    return this.render(request, reply, "pages/search.njk", {
      page: originalPages.find((page) => page.slug === ""),
      pageTitle: "Search",
      query,
      results: await searchPages(query),
    });
  }
}
export const referenceSiteController = new ReferenceSiteController();
