/**
 * Admin Controller
 * Handles admin dashboard and content management
 */
import { BaseController } from "./baseController.js";
import { pagesService } from "../services/pagesService.js";
import { memberService } from "../services/memberService.js";
import { siteService } from "../services/siteService.js";
import {
  originalPages,
  sanitizePageContent,
} from "../services/referenceSiteService.js";
import { renderView } from "../utils/viewEngine.js";

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
    const html = await renderView(request.server, "admin/pages/preview.njk", {
      content: sanitizePageContent(
        typeof request.body.content === "string" ? request.body.content : "",
      ),
      styles: source?.styles || [],
      bodyClass: source?.bodyClass || "",
    });
    return reply
      .header("Cache-Control", "no-store")
      .type("text/html")
      .send(html);
  }

  async newPage(request, reply) {
    await this.renderAdmin(request, reply, "admin/pages/form.njk", {
      pageTitle: "New Page",
      page: null,
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
      return this.renderAdmin(request, reply, "admin/pages/form.njk", {
        pageTitle: "New Page",
        page: { ...request.body, published: request.body.published === "on" },
        flash: { error: error.message },
      });
    }
  }

  async editPage(request, reply) {
    const page = await pagesService.getPageById(request.params.id);
    if (!page) {
      return reply.code(404).send("Page not found");
    }
    await this.renderAdmin(request, reply, "admin/pages/form.njk", {
      pageTitle: "Edit Page",
      page,
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
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/pages/form.njk", {
        pageTitle: "Edit Page",
        page: {
          ...existing,
          ...request.body,
          id: request.params.id,
          published: request.body.published === "on",
        },
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
    const members = await memberService.getAllMembers();
    await this.renderAdmin(request, reply, "admin/members/list.njk", {
      pageTitle: "Manage Members",
      members,
      memberPage: await pagesService.getPageBySlug("member-profiles"),
    });
  }

  async newMember(request, reply) {
    await this.renderAdmin(request, reply, "admin/members/form.njk", {
      pageTitle: "New Member",
      member: null,
    });
  }

  async createMember(request, reply) {
    try {
      const merits = request.body.merits
        ? request.body.merits.split("\n").map((m) => m.trim()).filter(Boolean)
        : [];

      // Build circleName from level and steelRank (e.g., "L7 - steel")
      const level = request.body.level;
      const steelRank = request.body.steelRank || level;
      const circleName = level === steelRank ? level : `${level} - ${steelRank.toLowerCase()}`;

      const member = await memberService.createMember({
        level,
        steelRank,
        circleName, // Level display name (e.g., "L7 - steel")
        position: request.body.circleName, // Member's circle name (from form's circleName field)
        merits: merits.length > 0 ? merits : (request.body.position ? [request.body.position] : []),
        memberSince: request.body.memberSince || "",
        region: request.body.region || "",
        biography: request.body.biography || "",
        image: request.body.image || "",
        active: request.body.active === "on",
      });
      request.session.adminFlash = { success: "Member created successfully" };
      reply.redirect(`/admin/members/${member.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/members/form.njk", {
        pageTitle: "New Member",
        member: { ...request.body, merits: request.body.merits },
        flash: { error: error.message },
      });
    }
  }

  async editMember(request, reply) {
    const member = await memberService.getMemberById(request.params.id);
    if (!member) {
      return reply.code(404).send("Member not found");
    }
    // Prepare member data for form (map database fields to form fields)
    const formMember = {
      ...member,
      circleName: member.position, // Form's circleName = member's circle name
      position: member.merits?.[0] || "", // Form's position = first merit (position/title)
    };
    await this.renderAdmin(request, reply, "admin/members/form.njk", {
      pageTitle: "Edit Member",
      member: formMember,
    });
  }

  async updateMember(request, reply) {
    try {
      const merits = request.body.merits
        ? request.body.merits.split("\n").map((m) => m.trim()).filter(Boolean)
        : [];

      // Build circleName from level and steelRank
      const level = request.body.level;
      const steelRank = request.body.steelRank || level;
      const circleName = level === steelRank ? level : `${level} - ${steelRank.toLowerCase()}`;

      await memberService.updateMember(request.params.id, {
        level,
        steelRank,
        circleName, // Level display name
        position: request.body.circleName, // Member's circle name
        merits: merits.length > 0 ? merits : (request.body.position ? [request.body.position] : []),
        memberSince: request.body.memberSince || "",
        region: request.body.region || "",
        biography: request.body.biography || "",
        image: request.body.image || "",
        active: request.body.active === "on",
      });
      request.session.adminFlash = { success: "Member updated successfully" };
      reply.redirect(`/admin/members/${request.params.id}/edit`);
    } catch (error) {
      const existing = await memberService.getMemberById(request.params.id);
      reply.code(existing ? 400 : 404);
      // Prepare member data for form
      const formMember = {
        ...existing,
        ...request.body,
        id: request.params.id,
        circleName: request.body.circleName,
        position: request.body.position,
        merits: request.body.merits,
      };
      return this.renderAdmin(request, reply, "admin/members/form.njk", {
        pageTitle: "Edit Member",
        member: formMember,
        flash: { error: error.message },
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

  // Settings
  async settings(request, reply) {
    const siteSettings = await siteService.getSiteSettings();
    const navigation = await siteService.getNavigation();

    await this.renderAdmin(request, reply, "admin/settings.njk", {
      pageTitle: "Site Settings",
      siteSettings,
      navigation,
      homePage: await pagesService.getPageBySlug(""),
      contactPage: await pagesService.getPageBySlug("contact"),
    });
  }

  async updateSettings(request, reply) {
    try {
      await siteService.updateSiteSettings(request.body);
      request.session.adminFlash = { success: "Settings updated successfully" };
      reply.redirect("/admin/settings");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/settings");
    }
  }

  async updateNavigation(request, reply) {
    try {
      await siteService.updateNavigation(request.body);
      request.session.adminFlash = {
        success: "Navigation updated successfully",
      };
      reply.redirect("/admin/settings");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/settings");
    }
  }
}

export const adminController = new AdminController();