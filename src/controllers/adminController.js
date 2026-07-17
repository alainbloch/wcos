/**
 * Admin Controller
 * Handles admin dashboard and content management
 */
import { BaseController } from './baseController.js';
import { pagesService } from '../services/pagesService.js';
import { memberService } from '../services/memberService.js';
import { championService } from '../services/championService.js';
import { councilService } from '../services/councilService.js';
import { classesService } from '../services/classesService.js';
import { ranksService } from '../services/ranksService.js';
import { coreMovesService } from '../services/coreMovesService.js';
import { dalmaterColorsService } from '../services/dalmaterColorsService.js';
import { kaidensService } from '../services/kaidensService.js';
import { resourcesService } from '../services/resourcesService.js';
import { duesService } from '../services/duesService.js';
import { siteService } from '../services/siteService.js';
import { navigationRepo } from '../models/database.js';

export class AdminController extends BaseController {
  async dashboard(request, reply) {
    const stats = {
      pages: (await pagesService.getAllPages()).length,
      members: (await memberService.getAllMembers()).length,
      champions: (await championService.getAllChampions()).length,
      council: (await councilService.getAllCouncilMembers()).length,
      classes: (await classesService.getAllClasses()).length,
      ranks: (await ranksService.getAllRanks()).length,
      coreMoves: (await coreMovesService.getAllCoreMoves()).length,
      dalmaterColors: (await dalmaterColorsService.getAllDalmaterColors()).length,
      kaidens: (await kaidensService.getAllKaidens()).length,
      resources: (await resourcesService.getAllResources()).length,
      dues: (await duesService.getAllDues()).length,
    };

    await this.renderAdmin(request, reply, 'admin/dashboard.njk', {
      pageTitle: 'Admin Dashboard',
      stats,
    });
  }

  // Pages management
  async listPages(request, reply) {
    const pages = await pagesService.getAllPages();
    await this.renderAdmin(request, reply, 'admin/pages/list.njk', {
      pageTitle: 'Manage Pages',
      pages,
    });
  }

  async newPage(request, reply) {
    await this.renderAdmin(request, reply, 'admin/pages/form.njk', {
      pageTitle: 'New Page',
      page: null,
    });
  }

  async createPage(request, reply) {
    try {
      const page = await pagesService.createPage(request.body);
      request.flash = { success: 'Page created successfully' };
      reply.redirect(`/admin/pages/${page.id}/edit`);
    } catch (error) {
      request.flash = { error: error.message };
      reply.redirect('/admin/pages/new');
    }
  }

  async editPage(request, reply) {
    const page = await pagesService.getPageById(request.params.id);
    if (!page) {
      return reply.code(404).send('Page not found');
    }
    await this.renderAdmin(request, reply, 'admin/pages/form.njk', {
      pageTitle: 'Edit Page',
      page,
    });
  }

  async updatePage(request, reply) {
    try {
      await pagesService.updatePage(request.params.id, request.body);
      request.flash = { success: 'Page updated successfully' };
      reply.redirect(`/admin/pages/${request.params.id}/edit`);
    } catch (error) {
      request.flash = { error: error.message };
      reply.redirect(`/admin/pages/${request.params.id}/edit`);
    }
  }

  async deletePage(request, reply) {
    try {
      await pagesService.deletePage(request.params.id);
      request.flash = { success: 'Page deleted successfully' };
      reply.redirect('/admin/pages');
    } catch (error) {
      request.flash = { error: error.message };
      reply.redirect('/admin/pages');
    }
  }

  // Members management
  async listMembers(request, reply) {
    const members = await memberService.getAllMembers();
    await this.renderAdmin(request, reply, 'admin/members/list.njk', {
      pageTitle: 'Manage Members',
      members,
    });
  }

  // Settings
  async settings(request, reply) {
    const siteSettings = await siteService.getSiteSettings();
    const navigation = await siteService.getNavigation();

    await this.renderAdmin(request, reply, 'admin/settings.njk', {
      pageTitle: 'Site Settings',
      siteSettings,
      navigation,
    });
  }

  async updateSettings(request, reply) {
    try {
      await siteService.updateSiteSettings(request.body);
      request.flash = { success: 'Settings updated successfully' };
      reply.redirect('/admin/settings');
    } catch (error) {
      request.flash = { error: error.message };
      reply.redirect('/admin/settings');
    }
  }

  async updateNavigation(request, reply) {
    try {
      await siteService.updateNavigation(request.body);
      request.flash = { success: 'Navigation updated successfully' };
      reply.redirect('/admin/settings');
    } catch (error) {
      request.flash = { error: error.message };
      reply.redirect('/admin/settings');
    }
  }
}

export const adminController = new AdminController();