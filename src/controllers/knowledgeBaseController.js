import { PublicPageController } from "./publicPageController.js";

export class KnowledgeBaseController extends PublicPageController {
  async rankRequirements(request, reply) {
    return this.renderPage(request, reply, "rank-requirements");
  }

  async coreMoves(request, reply) {
    return this.renderPage(request, reply, "core-moves");
  }

  async dalmaterColors(request, reply) {
    return this.renderPage(request, reply, "dalmater-colors");
  }

  async kaidens(request, reply) {
    return this.renderPage(request, reply, "kaidens");
  }

  async fighterClass(request, reply) {
    return this.renderPage(request, reply, "fighter-class");
  }

  async armor(request, reply) {
    return this.renderPage(request, reply, "armor");
  }

  async weapons(request, reply) {
    return this.renderPage(request, reply, "weapons");
  }

  async sparring(request, reply) {
    return this.renderPage(request, reply, "sparring");
  }

  async swordDance(request, reply) {
    return this.renderPage(request, reply, "sword-dance");
  }

  async glossary(request, reply) {
    return this.renderPage(request, reply, "glossary");
  }
}

export const knowledgeBaseController = new KnowledgeBaseController();
