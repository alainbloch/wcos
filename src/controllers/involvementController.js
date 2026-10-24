import { PublicPageController } from "./publicPageController.js";

export class InvolvementController extends PublicPageController {
  async classes(request, reply) {
    return this.renderPage(request, reply, "classes");
  }

  async etiquetteRules(request, reply) {
    return this.renderPage(request, reply, "wcos-etiquette-rules");
  }

  async dues(request, reply) {
    return this.renderPage(request, reply, "dues");
  }
}

export const involvementController = new InvolvementController();
