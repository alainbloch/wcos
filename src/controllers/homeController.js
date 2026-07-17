/**
 * Home Controller
 * Handles homepage
 */
import { BaseController } from './baseController.js';
import { memberService } from '../services/memberService.js';
import { championService } from '../services/championService.js';
import { councilService } from '../services/councilService.js';
import { siteService } from '../services/siteService.js';

export class HomeController extends BaseController {
  async index(request, reply) {
    const settings = await siteService.getSiteSettings();
    const featuredMembers = await memberService.getActiveMembers();
    const latestChampions = (await championService.getAllChampions()).slice(0, 5);
    const council = await councilService.getCurrentCouncil();

    await this.render(request, reply, 'pages/home.njk', {
      pageTitle: settings.heroTitle || 'Western Circle of Swordfighters',
      pageSubtitle: settings.heroSubtitle || 'experts',
      settings,
      featuredMembers: featuredMembers.slice(0, 4),
      latestChampions,
      council,
    });
  }
}

export const homeController = new HomeController();