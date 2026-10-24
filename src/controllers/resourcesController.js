import { PublicPageController } from "./publicPageController.js";

export class ResourcesController extends PublicPageController {
  async linksResources(request, reply) {
    return this.renderPage(request, reply, "links-resources");
  }

  async contactUs(request, reply) {
    return this.renderPage(request, reply, "contact");
  }

  async previousUpdates(request, reply) {
    return this.renderPage(request, reply, "updates");
  }

  async news(request, reply) {
    return this.renderPage(request, reply, "news");
  }
}

export const resourcesController = new ResourcesController();
