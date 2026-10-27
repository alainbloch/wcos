import { renderPageContent } from "../services/pageRenderingService.js";
import { readBinding } from "../services/collections/render.js";
import { viewService } from "../services/collections/views.js";
import { movesRepo, membersRepo, getDatabase } from "../models/database.js";
import { uploadMoveMedia } from "../services/moveMediaService.js";
/**
 * Admin Controller
 * Handles admin dashboard and content management
 */
import { BaseController } from "./baseController.js";
import { pagesService } from "../services/pagesService.js";
import { memberService } from "../services/memberService.js";
import { readClassForm, classesService } from "../services/classesService.js";
import {
  MOVE_TYPES,
  readMoveForm,
  movesService,
} from "../services/movesService.js";
import { siteService } from "../services/siteService.js";
import {
  originalPages,
  sanitizePageContent,
} from "../services/referenceSiteService.js";
import { renderView } from "../utils/viewEngine.js";
import { dynamicPageService } from "../services/dynamicPageService.js";

import {
  readMemberForm,
  memberFormToRecord,
  memberRecordToForm,
} from "../utils/memberForm.js";

import { memberImageService } from "../services/memberImageService.js";

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
  async listPages(request, reply) {
    const pages = await pagesService.getAllPages();
    await this.renderAdmin(request, reply, "admin/pages/list.njk", {
      pageTitle: "Manage Pages",
      pages,
    });
  }

  async previewPage(request, reply) {
    const page = request.body.id
      ? await pagesService.getPageById(request.body.id)
      : null;
    const source = originalPages.find((item) => item.slug === page?.slug);

    let content;
    try {
      const draft = {
        ...page,
        content:
          typeof request.body.content === "string" ? request.body.content : "",
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

    const html = await renderView(request.server, "admin/pages/preview.njk", {
      content,
      styles: source?.styles || [],
      bodyClass: source?.bodyClass || "",
    });
    return reply
      .header("Cache-Control", "no-store")
      .type("text/html")
      .send(html);
  }

  async newPage(request, reply) {
    const pages = await pagesService.getAllPages();
    await this.renderAdmin(request, reply, "admin/pages/form.njk", {
      dataViews: viewService.list().filter((v) => v.public),
      pageTitle: "New Page",
      page: null,
      pages,
    });
  }

  async createPage(request, reply) {
    try {
      const page = await pagesService.createPage({
        ...request.body,
        published: request.body.published === "on",
      });
      request.session.adminFlash = { success: "Page created successfully" };
      reply.redirect(`/admin/pages/${page.id}/edit`);
    } catch (error) {
      reply.code(400);
      const pages = await pagesService.getAllPages();
      return this.renderAdmin(request, reply, "admin/pages/form.njk", {
        dataViews: viewService.list().filter((v) => v.public),
        pageTitle: "New Page",
        page: { ...request.body, published: request.body.published === "on" },
        pages,
        flash: { error: error.message },
      });
    }
  }

  async editPage(request, reply) {
    const page = await pagesService.getPageById(request.params.id);
    if (!page) {
      return reply.code(404).send("Page not found");
    }
    const pages = await pagesService.getAllPages();
    await this.renderAdmin(request, reply, "admin/pages/form.njk", {
      dataViews: viewService.list().filter((v) => v.public),
      pageTitle: "Edit Page",
      page,
      pages,
    });
  }

  async updatePage(request, reply) {
    try {
      await pagesService.updatePage(request.params.id, {
        ...request.body,
        published: request.body.published === "on",
      });
      request.session.adminFlash = { success: "Page updated successfully" };
      reply.redirect(`/admin/pages/${request.params.id}/edit`);
    } catch (error) {
      const existing = await pagesService.getPageById(request.params.id);
      const pages = await pagesService.getAllPages();
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/pages/form.njk", {
        dataViews: viewService.list().filter((v) => v.public),
        pageTitle: "Edit Page",
        page: {
          ...existing,
          ...request.body,
          id: request.params.id,
          published: request.body.published === "on",
        },
        pages,
        flash: { error: error.message },
      });
    }
  }

  async deletePage(request, reply) {
    try {
      await pagesService.deletePage(request.params.id);
      request.session.adminFlash = { success: "Page deleted successfully" };
      reply.redirect("/admin/pages");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/pages");
    }
  }

  // Members management
  async listMembers(request, reply) {
    const councilFilter = ["all", "current"].includes(request.query.council)
      ? request.query.council
      : "";
    const members =
      councilFilter === "current"
        ? await memberService.getCurrentCouncilMembers()
        : councilFilter === "all"
          ? await memberService.getCouncilMembers()
          : await memberService.getAllMembers();
    await this.renderAdmin(request, reply, "admin/members/list.njk", {
      pageTitle: "Manage Members",
      councilFilter,
      honorsReview: getDatabase().data.honorsMigrationReview || [],
      members,
      memberPage: await pagesService.getPageBySlug("member-profiles"),
    });
  }

  async newMember(request, reply) {
    await this.renderAdmin(request, reply, "admin/members/form.njk", {
      kaidenColorOptions: await memberService.getKaidenColorOptions(
        request.params?.id,
      ),
      pageTitle: "New Member",
      member: null,
    });
  }

  async createMember(request, reply) {
    const form = readMemberForm(request.body);
    form.image = "";
    let uploadedImage;
    try {
      const record = memberFormToRecord(form);
      uploadedImage = await memberImageService.save(request.body?.image);
      record.image = uploadedImage || "";
      const member = await memberService.createMember(record);
      request.session.adminFlash = { success: "Member created successfully" };
      return reply.redirect(`/admin/members/${member.id}/edit`);
    } catch (error) {
      if (uploadedImage) {
        await memberImageService
          .discard(uploadedImage)
          .catch((cleanupError) => request.log.error(cleanupError));
      }
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/members/form.njk", {
        kaidenColorOptions: await memberService.getKaidenColorOptions(
          request.params?.id,
        ),
        pageTitle: "New Member",
        member: form,
        flash: {
          error: `${error.message}. If you selected an image, please select it again before saving.`,
        },
      });
    }
  }

  async editMember(request, reply) {
    const member = await memberService.getMemberById(request.params.id);
    if (!member) return reply.code(404).send("Member not found");
    return this.renderAdmin(request, reply, "admin/members/form.njk", {
      kaidenColorOptions: await memberService.getKaidenColorOptions(
        request.params?.id,
      ),
      pageTitle: "Edit Member",
      member: memberRecordToForm(member),
    });
  }

  async updateMember(request, reply) {
    const existing = await memberService.getMemberById(request.params.id);
    if (!existing) return reply.code(404).send("Member not found");
    const form = readMemberForm(request.body);
    form.image = existing.image || "";
    let uploadedImage;
    try {
      const record = memberFormToRecord(
        form,
        existing.importedFrom === "hall-of-heroes" && !existing.level,
      );
      uploadedImage = await memberImageService.save(request.body?.image);
      record.image = uploadedImage || form.image;
      const updated = await memberService.updateMember(
        request.params.id,
        record,
      );
      if (!updated) throw new Error("Member not found");
      request.session.adminFlash = { success: "Member updated successfully" };
      return reply.redirect(`/admin/members/${request.params.id}/edit`);
    } catch (error) {
      if (uploadedImage) {
        await memberImageService
          .discard(uploadedImage)
          .catch((cleanupError) => request.log.error(cleanupError));
      }
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/members/form.njk", {
        kaidenColorOptions: await memberService.getKaidenColorOptions(
          request.params?.id,
        ),
        pageTitle: "Edit Member",
        member: {
          ...form,
          importedFrom: existing.importedFrom,
          id: request.params.id,
          councilHistory: existing.councilHistory || [],
          dalmaterLegacyRecords: existing.dalmaterLegacyRecords || [],
        },
        flash: {
          error: `${error.message}. If you selected an image, please select it again before saving.`,
        },
      });
    }
  }

  async deleteMember(request, reply) {
    try {
      await memberService.deleteMember(request.params.id);
      request.session.adminFlash = { success: "Member deleted successfully" };
      reply.redirect("/admin/members");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/members");
    }
  }

  // Classes management
  async listClasses(request, reply) {
    const classes = await classesService.getAllClasses();
    await this.renderAdmin(request, reply, "admin/classes/list.njk", {
      pageTitle: "Manage Classes",
      classes,
    });
  }

  async classForm(request, reply, cls = { active: true }, flash) {
    return this.renderAdmin(request, reply, "admin/classes/form.njk", {
      pageTitle: cls.id ? "Edit Class" : "New Class",
      class: cls,
      instructors: await classesService.getInstructorOptions(),
      flash,
    });
  }
  async newClass(request, reply) {
    return this.classForm(request, reply);
  }
  async createClass(request, reply) {
    try {
      const cls = await classesService.createClass(request.body);
      return reply.redirect(`/admin/classes/${cls.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.classForm(request, reply, readClassForm(request.body), {
        error: error.message,
      });
    }
  }
  async editClass(request, reply) {
    const cls = await classesService.getClassById(request.params.id);
    if (!cls) return reply.code(404).send("Class not found");
    return this.classForm(request, reply, cls);
  }
  async updateClass(request, reply) {
    const existing = await classesService.getClassById(request.params.id);
    if (!existing) return reply.code(404).send("Class not found");
    try {
      await classesService.updateClass(request.params.id, request.body);
      return reply.redirect(`/admin/classes/${request.params.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.classForm(
        request,
        reply,
        { ...existing, ...readClassForm(request.body), id: request.params.id },
        { error: error.message },
      );
    }
  }

  async deleteClass(request, reply) {
    try {
      await classesService.deleteClass(request.params.id);
      request.session.adminFlash = { success: "Class deleted successfully" };
      reply.redirect("/admin/classes");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/classes");
    }
  }

  // Moves management
  async listMoves(request, reply) {
    return this.renderAdmin(request, reply, "admin/moves/list.njk", {
      pageTitle: "Moves",
      moves: await movesService.getAllMoves(),
    });
  }
  async moveForm(request, reply, move = {}, flash) {
    return this.renderAdmin(request, reply, "admin/moves/form.njk", {
      pageTitle: move.id ? "Edit Move" : "New Move",
      move,
      flash,
      mediaJson:
        typeof move.media === "string"
          ? move.media
          : JSON.stringify(move.media || []),
      creators: await membersRepo.findAll(),
      moveTypes: MOVE_TYPES,
    });
  }
  async newMove(request, reply) {
    return this.moveForm(request, reply);
  }
  async editMove(request, reply) {
    const move = await movesService.getMoveById(request.params.id);
    if (!move) return reply.code(404).send("Move not found");
    return this.moveForm(request, reply, move);
  }
  async createMove(request, reply) {
    try {
      const move = await movesService.createMove(request.body);
      return reply.redirect(`/admin/moves/${move.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.moveForm(request, reply, readMoveForm(request.body), {
        error: error.message,
      });
    }
  }
  async updateMove(request, reply) {
    if (!(await movesService.getMoveById(request.params.id)))
      return reply.code(404).send("Move not found");
    try {
      await movesService.updateMove(request.params.id, request.body);
      return reply.redirect(`/admin/moves/${request.params.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.moveForm(
        request,
        reply,
        { ...readMoveForm(request.body), id: request.params.id },
        { error: error.message },
      );
    }
  }
  async deleteMove(request, reply) {
    if (!(await movesService.getMoveById(request.params.id)))
      return reply.code(404).send("Move not found");
    await movesService.deleteMove(request.params.id);
    return reply.redirect("/admin/moves");
  }
  async reorderMoves(request, reply) {
    try {
      await movesRepo.reorder(request.body?.ids);
      return { saved: true };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  }
  async uploadMoveMedia(request, reply) {
    try {
      return await uploadMoveMedia(request.body?.file);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  }

  // Settings
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
