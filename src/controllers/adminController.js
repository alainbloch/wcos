import { collectionStore } from "../services/collections/store.js";
import { BaseController } from "./baseController.js";
import { pagesService } from "../services/pagesService.js";
import { siteService } from "../services/siteService.js";
import {
  originalPages,
  sanitizePageContent,
} from "../services/referenceSiteService.js";
import { renderView } from "../utils/viewEngine.js";
import { renderPageContent } from "../services/pageRenderingService.js";
import { readBinding } from "../services/collections/render.js";
import { viewService } from "../services/collections/views.js";

export class AdminController extends BaseController {
  async dashboard(request, reply) {
    const pages = await pagesService.getAllPages();
    const stats = {
      pages: pages.length,
      published: pages.filter((page) => page.published).length,
      drafts: pages.filter((page) => !page.published).length,
    };

    await this.renderAdmin(request, reply, "admin/dashboard.njk", {
      pageTitle: "Admin Dashboard",
      stats,
      recentPages: [...pages]
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
        .slice(0, 5),
    });
  }

  // Pages management
  async previewRecord(request, reply) {
    const definition = request.collectionDefinition;
    const contentField = definition.contentField || "content";
    const page = request.body.id
      ? collectionStore
          .rows(definition.id)
          .find((row) => row.id === request.body.id)
      : null;
    if (request.body.id && !page)
      return reply.code(404).send("Record not found.");
    const source = originalPages.find((item) => item.slug === page?.slug);

    let content;
    try {
      const draft = {
        ...page,
        content:
          typeof request.body.content === "string"
            ? request.body.content
            : typeof request.body[contentField] === "string"
              ? request.body[contentField]
              : page?.[contentField] || "",
        dataSources: Object.hasOwn(request.body, "dataSources")
          ? Array.isArray(request.body.dataSources)
            ? request.body.dataSources
            : String(request.body.dataSources || "")
                .split(",")
                .filter(Boolean)
          : page?.dataSources || [],
        dataView: readBinding(request.body, page?.dataView),
      };
      content =
        request.body.rawPreview === true
          ? sanitizePageContent(draft.content)
          : (
              await renderPageContent(
                request.server,
                draft,
                request.body.query || {},
              )
            ).content;
    } catch (error) {
      return reply.code(400).type("text/plain").send(error.message);
    }

    const html = await renderView(
      request.server,
      "admin/collections/preview.njk",
      {
        content,
        styles: source?.styles || [],
        bodyClass: source?.bodyClass || "",
      },
    );
    return reply
      .header("Cache-Control", "no-store")
      .type("text/html")
      .send(html);
  }

  async designRecord(request, reply) {
    const definition = request.collectionDefinition;
    const page = collectionStore
      .rows(definition.id)
      .find((row) => row.id === request.params.id);
    if (!page) {
      return reply.code(404).send("Page not found");
    }
    const pages = collectionStore.rows(definition.id);
    const collectionBase = `/admin/collections/${encodeURIComponent(definition.id)}`;
    await this.renderAdmin(request, reply, "admin/collections/design.njk", {
      dataViews: viewService.list().filter((v) => v.public),
      pageTitle: `Design ${definition.singularLabel || definition.label}`,
      page: {
        ...page,
        content: page[definition.contentField || "content"] || "",
      },
      pages,
      definition,
      collectionBase,
      previewUrl: `${collectionBase}/preview`,
      csrf: request.session.schemaCsrf,
    });
  }

  async settings(request, reply) {
    const siteSettings = await siteService.getSiteSettings();

    await this.renderAdmin(request, reply, "admin/settings.njk", {
      pageTitle: "Site Settings",
      siteSettings,
      homePage: await pagesService.getPageBySlug(""),
      contactPage: await pagesService.getPageBySlug("contact"),
    });
  }

  async updateSettings(request, reply) {
    try {
      await siteService.updateSiteSettings({ siteName: request.body.siteName });
      request.session.adminFlash = { success: "Settings updated successfully" };
      reply.redirect("/admin/settings");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/settings");
    }
  }
}

export const adminController = new AdminController();
