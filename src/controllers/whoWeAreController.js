/**
 * Who We Are Controller
 * Handles Member Profiles, Photo Gallery, WCOS Council, Hall of Heroes
 */
import { BaseController } from './baseController.js';
import { memberService } from '../services/memberService.js';
import { championService } from '../services/championService.js';
import { councilService } from '../services/councilService.js';
import { pagesService } from '../services/pagesService.js';

export class WhoWeAreController extends BaseController {
  async memberProfiles(request, reply) {
    const membersGrouped = await memberService.getMembersGroupedByLevel();

    await this.render(request, reply, 'pages/who-we-are/member-profiles.njk', {
      pageTitle: 'Member Profiles & Rankings',
      membersGrouped,
    });
  }

  async photoGallery(request, reply) {
    // Photo gallery - placeholder for future implementation
    await this.render(request, reply, 'pages/who-we-are/photo-gallery.njk', {
      pageTitle: 'Photo Gallery',
      photos: [],
    });
  }

  async wcosCouncil(request, reply) {
    const council = await councilService.getCurrentCouncil();
    const allCouncil = await councilService.getAllCouncilMembers();

    // Get historical dates from page content or settings
    const historicalDates = allCouncil
      .filter(c => c.historicalDate)
      .sort((a, b) => new Date(b.historicalDate) - new Date(a.historicalDate));

    await this.render(request, reply, 'pages/who-we-are/wcos-council.njk', {
      pageTitle: 'WCoS Council',
      council,
      historicalDates,
    });
  }

  async hallOfHeroes(request, reply) {
    const champions = await championService.getAllChampions();
    const championsByDecade = await championService.getChampionsGroupedByDecade();

    await this.render(request, reply, 'pages/who-we-are/hall-of-heroes.njk', {
      pageTitle: 'Hall of Heroes',
      pageSubtitle: 'Best of the Best Champions & Legends',
      champions,
      championsByDecade,
    });
  }
}

export const whoWeAreController = new WhoWeAreController();