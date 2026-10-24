import { movesRepo, membersRepo } from '../models/database.js';
import { uploadMoveMedia } from '../services/moveMediaService.js';
/**
 * Admin Controller
 * Handles admin dashboard and content management
 */
import { BaseController } from "./baseController.js";
import { pagesService } from "../services/pagesService.js";
import { memberService } from "../services/memberService.js";
import { championService } from "../services/championService.js";
import { classesService } from "../services/classesService.js";
import { ranksService } from "../services/ranksService.js";
import { readMoveForm, movesService } from "../services/movesService.js";
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

import { readMemberForm, memberFormToRecord, memberRecordToForm } from "../utils/memberForm.js";

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
    const councilFilter = ["all", "current"].includes(request.query.council) ? request.query.council : "";
    const members = councilFilter === "current" ? await memberService.getCurrentCouncilMembers()
      : councilFilter === "all" ? await memberService.getCouncilMembers()
      : await memberService.getAllMembers();
    await this.renderAdmin(request, reply, "admin/members/list.njk", {
      pageTitle: "Manage Members",
      councilFilter,
      members,
      memberPage: await pagesService.getPageBySlug("member-profiles"),
    });
  }

  async newMember(request, reply) {
    await this.renderAdmin(request, reply, "admin/members/form.njk", {
      kaidenColorOptions: await memberService.getKaidenColorOptions(request.params?.id),
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
        await memberImageService.discard(uploadedImage).catch(cleanupError => request.log.error(cleanupError));
      }
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/members/form.njk", {
      kaidenColorOptions: await memberService.getKaidenColorOptions(request.params?.id),
        pageTitle: "New Member",
        member: form,
        flash: { error: `${error.message}. If you selected an image, please select it again before saving.` },
      });
    }
  }

  async editMember(request, reply) {
    const member = await memberService.getMemberById(request.params.id);
    if (!member) return reply.code(404).send("Member not found");
    return this.renderAdmin(request, reply, "admin/members/form.njk", {
      kaidenColorOptions: await memberService.getKaidenColorOptions(request.params?.id),
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
      const record = memberFormToRecord(form);
      uploadedImage = await memberImageService.save(request.body?.image);
      record.image = uploadedImage || form.image;
      const updated = await memberService.updateMember(request.params.id, record);
      if (!updated) throw new Error("Member not found");
      request.session.adminFlash = { success: "Member updated successfully" };
      return reply.redirect(`/admin/members/${request.params.id}/edit`);
    } catch (error) {
      if (uploadedImage) {
        await memberImageService.discard(uploadedImage).catch(cleanupError => request.log.error(cleanupError));
      }
      reply.code(400);
      return this.renderAdmin(request, reply, "admin/members/form.njk", {
      kaidenColorOptions: await memberService.getKaidenColorOptions(request.params?.id),
        pageTitle: "Edit Member",
        member: { ...form, id: request.params.id, councilHistory: existing.councilHistory || [], dalmaterLegacyRecords: existing.dalmaterLegacyRecords || [] },
        flash: { error: `${error.message}. If you selected an image, please select it again before saving.` },
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

  // Moves management
  async listMoves(request, reply) {
    return this.renderAdmin(request, reply, 'admin/moves/list.njk', { pageTitle: 'Moves', moves: await movesService.getAllMoves() });
  }
  async moveForm(request, reply, move = {}, flash) {
    return this.renderAdmin(request, reply, 'admin/moves/form.njk', {
      pageTitle: move.id ? 'Edit Move' : 'New Move', move, flash,
      mediaJson: typeof move.media === 'string' ? move.media : JSON.stringify(move.media || []),
      creators: await membersRepo.findAll(),
    });
  }
  async newMove(request, reply) { return this.moveForm(request, reply); }
  async editMove(request, reply) {
    const move = await movesService.getMoveById(request.params.id);
    if (!move) return reply.code(404).send('Move not found');
    return this.moveForm(request, reply, move);
  }
  async createMove(request, reply) {
    try {
      const move = await movesService.createMove(request.body);
      return reply.redirect(`/admin/moves/${move.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.moveForm(request, reply, readMoveForm(request.body), { error: error.message });
    }
  }
  async updateMove(request, reply) {
    if (!await movesService.getMoveById(request.params.id)) return reply.code(404).send('Move not found');
    try {
      await movesService.updateMove(request.params.id, request.body);
      return reply.redirect(`/admin/moves/${request.params.id}/edit`);
    } catch (error) {
      reply.code(400);
      return this.moveForm(request, reply, { ...readMoveForm(request.body), id: request.params.id }, { error: error.message });
    }
  }
  async deleteMove(request, reply) {
    if (!await movesService.getMoveById(request.params.id)) return reply.code(404).send('Move not found');
    await movesService.deleteMove(request.params.id);
    return reply.redirect('/admin/moves');
  }
  async reorderMoves(request, reply) {
    try { await movesRepo.reorder(request.body?.ids); return { saved: true }; }
    catch (error) { return reply.code(400).send({ error: error.message }); }
  }
  async uploadMoveMedia(request, reply) {
    try { return await uploadMoveMedia(request.body?.file); }
    catch (error) { return reply.code(400).send({ error: error.message }); }
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