/**
 * Admin Controller
 * Handles admin dashboard and content management
 */
import { BaseController } from "./baseController.js";
import { pagesService } from "../services/pagesService.js";
import { memberService } from "../services/memberService.js";
import { championService } from "../services/championService.js";
import { councilService } from "../services/councilService.js";
import { classesService } from "../services/classesService.js";
import { ranksService } from "../services/ranksService.js";
import { coreMovesService } from "../services/coreMovesService.js";
import { dalmaterColorsService } from "../services/dalmaterColorsService.js";
import { kaidensService } from "../services/kaidensService.js";
import { resourcesService } from "../services/resourcesService.js";
import { duesService } from "../services/duesService.js";
import { siteService } from "../services/siteService.js";
import {
  originalPages,
  sanitizePageContent,
} from "../services/referenceSiteService.js";
import { renderView } from "../utils/viewEngine.js";
import { dynamicPageService } from "../services/dynamicPageService.js";

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

    let content = sanitizePageContent(
      typeof request.body.content === "string" ? request.body.content : "",
    );

    // If the page uses dynamic sources, resolve and inject them into preview
    if (page && page.dataSources && page.dataSources.length > 0) {
      const data = await dynamicPageService.resolveDataSources(page.dataSources || []);
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
      position: (member.merits?.[0] || ""), // Form's position = first merit (position/title)
      merits: Array.isArray(member.merits) ? member.merits : (member.merits ? String(member.merits).split("\n").filter(Boolean) : []),
    };
    await this.renderAdmin(request, reply, "admin/members/form.njk", {
      pageTitle: "Edit Member",
      member: formMember,
    });
  }

  async updateMember(request, reply) {
    /**
     * Normalize merits into an array.
     *
     * Supports:
     * - Arrays
     * - JSON-encoded arrays
     * - Newline-separated strings
     * - Empty or missing values
     */
    const normalizeMerits = (value) => {
      if (Array.isArray(value)) {
        return value
          .map((merit) => String(merit).trim())
          .filter(Boolean);
      }

      if (typeof value === "string") {
        const trimmed = value.trim();

        if (!trimmed) return [];

        // Handle JSON-encoded arrays stored in the database.
        try {
          const parsed = JSON.parse(trimmed);

          if (Array.isArray(parsed)) {
            return parsed
              .map((merit) => String(merit).trim())
              .filter(Boolean);
          }
        } catch {
          // Not JSON; interpret as newline-separated text.
        }

        return trimmed
          .split(/\r?\n/)
          .map((merit) => merit.trim())
          .filter(Boolean);
      }

      return [];
    };

    try {
      // Build circleName from level and steelRank
      const level = request.body.level;
      const steelRank = request.body.steelRank || level;
      const merits = normalizeMerits(request.body.merits);

      await memberService.updateMember(request.params.id, {
        level,
        steelRank,
        circleName: request.body.circleName, // Level display name
        position: request.body.position, // Member's circle name
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
      const body = request.body || {};
      console.log("\n\n\nHEY!!!\n\n\n", body);
      const formMember = {
        ...existing,
        ...body,
        id: request.params.id,
        circleName: body.circleName,
        position: body.position,
        merits: normalizeMerits(body.merits),
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

  // Champions management
  async listChampions(request, reply) {
    const champions = await championService.getAllChampions();
    await this.renderAdmin(request, reply, "admin/champions/list.njk", {
      pageTitle: "Manage Champions",
      champions,
    });
  }

  async newChampion(request, reply) {
    await this.renderAdmin(request, reply, "admin/champions/form.njk", {
      pageTitle: "New Champion",
      champion: null,
    });
  }

  async createChampion(request, reply) {
    try {
      const champion = await championService.createChampion(request.body);
      request.session.adminFlash = { success: "Champion created successfully" };
      reply.redirect(`/admin/champions/${champion.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/champions/form.njk", {
        pageTitle: "New Champion",
        champion: request.body,
        flash: { error: error.message },
      });
    }
  }

  async editChampion(request, reply) {
    const champion = await championService.getChampionById(request.params.id);
    if (!champion) {
      return reply.code(404).send("Champion not found");
    }
    await this.renderAdmin(request, reply, "admin/champions/form.njk", {
      pageTitle: "Edit Champion",
      champion,
    });
  }

  async updateChampion(request, reply) {
    try {
      await championService.updateChampion(request.params.id, request.body);
      request.session.adminFlash = { success: "Champion updated successfully" };
      reply.redirect(`/admin/champions/${request.params.id}/edit`);
    } catch (error) {
      const existing = await championService.getChampionById(request.params.id);
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/champions/form.njk", {
        pageTitle: "Edit Champion",
        champion: { ...existing, ...request.body, id: request.params.id },
        flash: { error: error.message },
      });
    }
  }

  async deleteChampion(request, reply) {
    try {
      await championService.deleteChampion(request.params.id);
      request.session.adminFlash = { success: "Champion deleted successfully" };
      reply.redirect("/admin/champions");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/champions");
    }
  }

  // Council Members management
  async listCouncilMembers(request, reply) {
    const councilMembers = await councilService.getAllCouncilMembers();
    await this.renderAdmin(request, reply, "admin/council/list.njk", {
      pageTitle: "Manage Council Members",
      councilMembers,
    });
  }

  async newCouncilMember(request, reply) {
    await this.renderAdmin(request, reply, "admin/council/form.njk", {
      pageTitle: "New Council Member",
      councilMember: null,
    });
  }

  async createCouncilMember(request, reply) {
    try {
      const councilMember = await councilService.createCouncilMember(request.body);
      request.session.adminFlash = { success: "Council member created successfully" };
      reply.redirect(`/admin/council/${councilMember.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/council/form.njk", {
        pageTitle: "New Council Member",
        councilMember: request.body,
        flash: { error: error.message },
      });
    }
  }

  async editCouncilMember(request, reply) {
    const councilMember = await councilService.getCouncilMemberById(request.params.id);
    if (!councilMember) {
      return reply.code(404).send("Council member not found");
    }
    await this.renderAdmin(request, reply, "admin/council/form.njk", {
      pageTitle: "Edit Council Member",
      councilMember,
    });
  }

  async updateCouncilMember(request, reply) {
    try {
      await councilService.updateCouncilMember(request.params.id, request.body);
      request.session.adminFlash = { success: "Council member updated successfully" };
      reply.redirect(`/admin/council/${request.params.id}/edit`);
    } catch (error) {
      const existing = await councilService.getCouncilMemberById(request.params.id);
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/council/form.njk", {
        pageTitle: "Edit Council Member",
        councilMember: { ...existing, ...request.body, id: request.params.id },
        flash: { error: error.message },
      });
    }
  }

  async deleteCouncilMember(request, reply) {
    try {
      await councilService.deleteCouncilMember(request.params.id);
      request.session.adminFlash = { success: "Council member deleted successfully" };
      reply.redirect("/admin/council");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/council");
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

  async newClass(request, reply) {
    await this.renderAdmin(request, reply, "admin/classes/form.njk", {
      pageTitle: "New Class",
      class: null,
    });
  }

  async createClass(request, reply) {
    try {
      const cls = await classesService.createClass(request.body);
      request.session.adminFlash = { success: "Class created successfully" };
      reply.redirect(`/admin/classes/${cls.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/classes/form.njk", {
        pageTitle: "New Class",
        class: request.body,
        flash: { error: error.message },
      });
    }
  }

  async editClass(request, reply) {
    const cls = await classesService.getClassById(request.params.id);
    if (!cls) {
      return reply.code(404).send("Class not found");
    }
    await this.renderAdmin(request, reply, "admin/classes/form.njk", {
      pageTitle: "Edit Class",
      class: cls,
    });
  }

  async updateClass(request, reply) {
    try {
      await classesService.updateClass(request.params.id, request.body);
      request.session.adminFlash = { success: "Class updated successfully" };
      reply.redirect(`/admin/classes/${request.params.id}/edit`);
    } catch (error) {
      const existing = await classesService.getClassById(request.params.id);
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/classes/form.njk", {
        pageTitle: "Edit Class",
        class: { ...existing, ...request.body, id: request.params.id },
        flash: { error: error.message },
      });
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

  // Ranks management
  async listRanks(request, reply) {
    const ranks = await ranksService.getAllRanks();
    await this.renderAdmin(request, reply, "admin/ranks/list.njk", {
      pageTitle: "Manage Ranks",
      ranks,
    });
  }

  async newRank(request, reply) {
    await this.renderAdmin(request, reply, "admin/ranks/form.njk", {
      pageTitle: "New Rank",
      rank: null,
    });
  }

  async createRank(request, reply) {
    try {
      const rank = await ranksService.createRank(request.body);
      request.session.adminFlash = { success: "Rank created successfully" };
      reply.redirect(`/admin/ranks/${rank.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/ranks/form.njk", {
        pageTitle: "New Rank",
        rank: request.body,
        flash: { error: error.message },
      });
    }
  }

  async editRank(request, reply) {
    const rank = await ranksService.getRankByLevel(request.params.id);
    if (!rank) {
      return reply.code(404).send("Rank not found");
    }
    await this.renderAdmin(request, reply, "admin/ranks/form.njk", {
      pageTitle: "Edit Rank",
      rank,
    });
  }

  async updateRank(request, reply) {
    try {
      await ranksService.updateRank(request.params.id, request.body);
      request.session.adminFlash = { success: "Rank updated successfully" };
      reply.redirect(`/admin/ranks/${request.params.id}/edit`);
    } catch (error) {
      const existing = await ranksService.getRankByLevel(request.params.id);
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/ranks/form.njk", {
        pageTitle: "Edit Rank",
        rank: { ...existing, ...request.body, id: request.params.id },
        flash: { error: error.message },
      });
    }
  }

  async deleteRank(request, reply) {
    try {
      await ranksService.deleteRank(request.params.id);
      request.session.adminFlash = { success: "Rank deleted successfully" };
      reply.redirect("/admin/ranks");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/ranks");
    }
  }

  // Core Moves management
  async listCoreMoves(request, reply) {
    const coreMoves = await coreMovesService.getAllCoreMoves();
    await this.renderAdmin(request, reply, "admin/coreMoves/list.njk", {
      pageTitle: "Manage Core Moves",
      coreMoves,
    });
  }

  async newCoreMove(request, reply) {
    await this.renderAdmin(request, reply, "admin/coreMoves/form.njk", {
      pageTitle: "New Core Move",
      coreMove: null,
    });
  }

  async createCoreMove(request, reply) {
    try {
      const coreMove = await coreMovesService.createCoreMove(request.body);
      request.session.adminFlash = { success: "Core move created successfully" };
      reply.redirect(`/admin/core-moves/${coreMove.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/coreMoves/form.njk", {
        pageTitle: "New Core Move",
        coreMove: request.body,
        flash: { error: error.message },
      });
    }
  }

  async editCoreMove(request, reply) {
    const coreMove = await coreMovesService.getCoreMoveById(request.params.id);
    if (!coreMove) {
      return reply.code(404).send("Core move not found");
    }
    await this.renderAdmin(request, reply, "admin/coreMoves/form.njk", {
      pageTitle: "Edit Core Move",
      coreMove,
    });
  }

  async updateCoreMove(request, reply) {
    try {
      await coreMovesService.updateCoreMove(request.params.id, request.body);
      request.session.adminFlash = { success: "Core move updated successfully" };
      reply.redirect(`/admin/core-moves/${request.params.id}/edit`);
    } catch (error) {
      const existing = await coreMovesService.getCoreMoveById(request.params.id);
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/coreMoves/form.njk", {
        pageTitle: "Edit Core Move",
        coreMove: { ...existing, ...request.body, id: request.params.id },
        flash: { error: error.message },
      });
    }
  }

  async deleteCoreMove(request, reply) {
    try {
      await coreMovesService.deleteCoreMove(request.params.id);
      request.session.adminFlash = { success: "Core move deleted successfully" };
      reply.redirect("/admin/core-moves");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/core-moves");
    }
  }

  // Dalmater Colors management
  async listDalmaterColors(request, reply) {
    const dalmaterColors = await dalmaterColorsService.getAllDalmaterColors();
    await this.renderAdmin(request, reply, "admin/dalmaterColors/list.njk", {
      pageTitle: "Manage Dalmater Colors",
      dalmaterColors,
    });
  }

  async newDalmaterColor(request, reply) {
    await this.renderAdmin(request, reply, "admin/dalmaterColors/form.njk", {
      pageTitle: "New Dalmater Color",
      dalmaterColor: null,
    });
  }

  async createDalmaterColor(request, reply) {
    try {
      const dalmaterColor = await dalmaterColorsService.createDalmaterColor(request.body);
      request.session.adminFlash = { success: "Dalmater color created successfully" };
      reply.redirect(`/admin/dalmater-colors/${dalmaterColor.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/dalmaterColors/form.njk", {
        pageTitle: "New Dalmater Color",
        dalmaterColor: request.body,
        flash: { error: error.message },
      });
    }
  }

  async editDalmaterColor(request, reply) {
    const dalmaterColor = await dalmaterColorsService.getDalmaterColorById(request.params.id);
    if (!dalmaterColor) {
      return reply.code(404).send("Dalmater color not found");
    }
    await this.renderAdmin(request, reply, "admin/dalmaterColors/form.njk", {
      pageTitle: "Edit Dalmater Color",
      dalmaterColor,
    });
  }

  async updateDalmaterColor(request, reply) {
    try {
      await dalmaterColorsService.updateDalmaterColor(request.params.id, request.body);
      request.session.adminFlash = { success: "Dalmater color updated successfully" };
      reply.redirect(`/admin/dalmater-colors/${request.params.id}/edit`);
    } catch (error) {
      const existing = await dalmaterColorsService.getDalmaterColorById(request.params.id);
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/dalmaterColors/form.njk", {
        pageTitle: "Edit Dalmater Color",
        dalmaterColor: { ...existing, ...request.body, id: request.params.id },
        flash: { error: error.message },
      });
    }
  }

  async deleteDalmaterColor(request, reply) {
    try {
      await dalmaterColorsService.deleteDalmaterColor(request.params.id);
      request.session.adminFlash = { success: "Dalmater color deleted successfully" };
      reply.redirect("/admin/dalmater-colors");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/dalmater-colors");
    }
  }

  // Kaidens management
  async listKaidens(request, reply) {
    const kaidens = await kaidensService.getAllKaidens();
    await this.renderAdmin(request, reply, "admin/kaidens/list.njk", {
      pageTitle: "Manage Kaidens",
      kaidens,
    });
  }

  async newKaiden(request, reply) {
    await this.renderAdmin(request, reply, "admin/kaidens/form.njk", {
      pageTitle: "New Kaiden",
      kaiden: null,
    });
  }

  async createKaiden(request, reply) {
    try {
      const kaiden = await kaidensService.createKaiden(request.body);
      request.session.adminFlash = { success: "Kaiden created successfully" };
      reply.redirect(`/admin/kaidens/${kaiden.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/kaidens/form.njk", {
        pageTitle: "New Kaiden",
        kaiden: request.body,
        flash: { error: error.message },
      });
    }
  }

  async editKaiden(request, reply) {
    const kaiden = await kaidensService.getKaidenById(request.params.id);
    if (!kaiden) {
      return reply.code(404).send("Kaiden not found");
    }
    await this.renderAdmin(request, reply, "admin/kaidens/form.njk", {
      pageTitle: "Edit Kaiden",
      kaiden,
    });
  }

  async updateKaiden(request, reply) {
    try {
      await kaidensService.updateKaiden(request.params.id, request.body);
      request.session.adminFlash = { success: "Kaiden updated successfully" };
      reply.redirect(`/admin/kaidens/${request.params.id}/edit`);
    } catch (error) {
      const existing = await kaidensService.getKaidenById(request.params.id);
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/kaidens/form.njk", {
        pageTitle: "Edit Kaiden",
        kaiden: { ...existing, ...request.body, id: request.params.id },
        flash: { error: error.message },
      });
    }
  }

  async deleteKaiden(request, reply) {
    try {
      await kaidensService.deleteKaiden(request.params.id);
      request.session.adminFlash = { success: "Kaiden deleted successfully" };
      reply.redirect("/admin/kaidens");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/kaidens");
    }
  }

  // Kaiden Rules management
  async listKaidenRules(request, reply) {
    const kaidenRules = await kaidensService.getAllKaidenRules();
    await this.renderAdmin(request, reply, "admin/kaidenRules/list.njk", {
      pageTitle: "Manage Kaiden Rules",
      kaidenRules,
    });
  }

  async newKaidenRule(request, reply) {
    await this.renderAdmin(request, reply, "admin/kaidenRules/form.njk", {
      pageTitle: "New Kaiden Rule",
      kaidenRule: null,
    });
  }

  async createKaidenRule(request, reply) {
    try {
      const kaidenRule = await kaidensService.createKaidenRule(request.body);
      request.session.adminFlash = { success: "Kaiden rule created successfully" };
      reply.redirect(`/admin/kaiden-rules/${kaidenRule.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/kaidenRules/form.njk", {
        pageTitle: "New Kaiden Rule",
        kaidenRule: request.body,
        flash: { error: error.message },
      });
    }
  }

  async editKaidenRule(request, reply) {
    const kaidenRule = await kaidensService.getKaidenRuleById(request.params.id);
    if (!kaidenRule) {
      return reply.code(404).send("Kaiden rule not found");
    }
    await this.renderAdmin(request, reply, "admin/kaidenRules/form.njk", {
      pageTitle: "Edit Kaiden Rule",
      kaidenRule,
    });
  }

  async updateKaidenRule(request, reply) {
    try {
      await kaidensService.updateKaidenRule(request.params.id, request.body);
      request.session.adminFlash = { success: "Kaiden rule updated successfully" };
      reply.redirect(`/admin/kaiden-rules/${request.params.id}/edit`);
    } catch (error) {
      const existing = await kaidensService.getKaidenRuleById(request.params.id);
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/kaidenRules/form.njk", {
        pageTitle: "Edit Kaiden Rule",
        kaidenRule: { ...existing, ...request.body, id: request.params.id },
        flash: { error: error.message },
      });
    }
  }

  async deleteKaidenRule(request, reply) {
    try {
      await kaidensService.deleteKaidenRule(request.params.id);
      request.session.adminFlash = { success: "Kaiden rule deleted successfully" };
      reply.redirect("/admin/kaiden-rules");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/kaiden-rules");
    }
  }

  // Resources management
  async listResources(request, reply) {
    const resources = await resourcesService.getAllResources();
    await this.renderAdmin(request, reply, "admin/resources/list.njk", {
      pageTitle: "Manage Resources",
      resources,
    });
  }

  async newResource(request, reply) {
    await this.renderAdmin(request, reply, "admin/resources/form.njk", {
      pageTitle: "New Resource",
      resource: null,
    });
  }

  async createResource(request, reply) {
    try {
      const resource = await resourcesService.createResource(request.body);
      request.session.adminFlash = { success: "Resource created successfully" };
      reply.redirect(`/admin/resources/${resource.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/resources/form.njk", {
        pageTitle: "New Resource",
        resource: request.body,
        flash: { error: error.message },
      });
    }
  }

  async editResource(request, reply) {
    const resource = await resourcesService.getResourceById(request.params.id);
    if (!resource) {
      return reply.code(404).send("Resource not found");
    }
    await this.renderAdmin(request, reply, "admin/resources/form.njk", {
      pageTitle: "Edit Resource",
      resource,
    });
  }

  async updateResource(request, reply) {
    try {
      await resourcesService.updateResource(request.params.id, request.body);
      request.session.adminFlash = { success: "Resource updated successfully" };
      reply.redirect(`/admin/resources/${request.params.id}/edit`);
    } catch (error) {
      const existing = await resourcesService.getResourceById(request.params.id);
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/resources/form.njk", {
        pageTitle: "Edit Resource",
        resource: { ...existing, ...request.body, id: request.params.id },
        flash: { error: error.message },
      });
    }
  }

  async deleteResource(request, reply) {
    try {
      await resourcesService.deleteResource(request.params.id);
      request.session.adminFlash = { success: "Resource deleted successfully" };
      reply.redirect("/admin/resources");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/resources");
    }
  }

  // Dues management
  async listDues(request, reply) {
    const dues = await duesService.getAllDues();
    await this.renderAdmin(request, reply, "admin/dues/list.njk", {
      pageTitle: "Manage Dues/Donations",
      dues,
    });
  }

  async newDues(request, reply) {
    await this.renderAdmin(request, reply, "admin/dues/form.njk", {
      pageTitle: "New Dues/Donation",
      dues: null,
    });
  }

  async createDues(request, reply) {
    try {
      const dues = await duesService.createDues(request.body);
      request.session.adminFlash = { success: "Dues/Donation created successfully" };
      reply.redirect(`/admin/dues/${dues.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/dues/form.njk", {
        pageTitle: "New Dues/Donation",
        dues: request.body,
        flash: { error: error.message },
      });
    }
  }

  async editDues(request, reply) {
    const dues = await duesService.getDuesById(request.params.id);
    if (!dues) {
      return reply.code(404).send("Dues not found");
    }
    await this.renderAdmin(request, reply, "admin/dues/form.njk", {
      pageTitle: "Edit Dues/Donation",
      dues,
    });
  }

  async updateDues(request, reply) {
    try {
      await duesService.updateDues(request.params.id, request.body);
      request.session.adminFlash = { success: "Dues/Donation updated successfully" };
      reply.redirect(`/admin/dues/${request.params.id}/edit`);
    } catch (error) {
      const existing = await duesService.getDuesById(request.params.id);
      reply.code(existing ? 400 : 404);
      return this.renderAdmin(request, reply, "admin/dues/form.njk", {
        pageTitle: "Edit Dues/Donation",
        dues: { ...existing, ...request.body, id: request.params.id },
        flash: { error: error.message },
      });
    }
  }

  async deleteDues(request, reply) {
    try {
      await duesService.deleteDues(request.params.id);
      request.session.adminFlash = { success: "Dues/Donation deleted successfully" };
      reply.redirect("/admin/dues");
    } catch (error) {
      request.session.adminFlash = { error: error.message };
      reply.redirect("/admin/dues");
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