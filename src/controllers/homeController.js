import { PublicPageController } from "./publicPageController.js";

export class HomeController extends PublicPageController {
  async index(request, reply) {
    if (request.query.s)
      return reply.redirect(`/search?q=${encodeURIComponent(request.query.s)}`);
    return this.renderPage(request, reply, "");
  }
}

export const homeController = new HomeController();
