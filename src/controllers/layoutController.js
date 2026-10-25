import { BaseController } from "./baseController.js";
import { usersController } from "./usersController.js";
import { siteSettingsRepo } from "../models/siteSettingsRepository.js";
import { originalPages } from "../services/referenceSiteService.js";
import {
  getLayout,
  layoutContext,
  layoutDefaults,
  layoutSections,
  renderLayoutTemplate,
  saveLayout,
  validateLayout,
} from "../services/layoutService.js";

export class LayoutController extends BaseController {
  async guard(request, reply) {
    await usersController.guard(request, reply);
    if (
      !reply.sent &&
      request.params.section &&
      !layoutSections.includes(request.params.section)
    )
      return reply.code(404).send("Layout section not found");
  }
  async edit(request, reply, content, error) {
    const section = request.params.section || "header";
    const saved = await getLayout();
    return this.renderAdmin(request, reply, "admin/layout.njk", {
      pageTitle: "Layout",
      section,
      content: content ?? saved[section],
      csrf: request.session.userCsrf,
      ...(error ? { flash: { error } } : {}),
    });
  }
  async update(request, reply) {
    try {
      await saveLayout(request.params.section, request.body.content);
      request.session.adminFlash = {
        success: "Layout saved. Changes are now live.",
      };
      return reply.redirect(`/admin/layout/${request.params.section}`);
    } catch (error) {
      reply.code(400);
      return this.edit(
        request,
        reply,
        typeof request.body.content === "string" ? request.body.content : "",
        error.message,
      );
    }
  }
  async restore(request, reply) {
    const section = request.params.section;
    await saveLayout(section, (await layoutDefaults())[section]);
    request.session.adminFlash = { success: "Default restored." };
    return reply.redirect(`/admin/layout/${section}`);
  }
  async preview(request, reply) {
    try {
      const section = request.params.section;
      const content = request.body.content;
      const settings = await siteSettingsRepo.getSettings();
      const context = layoutContext(
        settings,
        originalPages.find((page) => page.slug === ""),
      );
      validateLayout(section, content, context);
      const saved = await getLayout();
      const css = section === "css" ? content : saved.css;
      const styles = (
        originalPages.find((page) => page.slug === "")?.styles || []
      )
        .map((href) => `<link rel="stylesheet" href="${href}">`)
        .join("");
      const rendered =
        section === "css"
          ? renderLayoutTemplate(
              saved.header +
                "<main><p>Page content preview</p></main>" +
                saved.footer,
              context,
            )
          : renderLayoutTemplate(content, context);
      // Sandboxed by the editor; escape style termination so CSS stays CSS.
      return reply
        .type("text/html")
        .send(
          `<!doctype html><html><head><link rel="stylesheet" href="/css/fonts.css">${styles}<link rel="stylesheet" href="/css/reference.css"><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body class="reference-site"><div id="editable-content">${rendered}</div></body></html>`,
        );
    } catch (error) {
      return reply
        .code(400)
        .type("text/plain")
        .send(`Preview error: ${error.message}`);
    }
  }
}
export const layoutController = new LayoutController();
