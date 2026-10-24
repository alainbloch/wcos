/**
 * Involvement Controller
 * Handles Classes, WCOS Etiquette & Rules, Dues/Donations
 */
import { BaseController } from './baseController.js';
import { classesService } from '../services/classesService.js';
import { pagesService } from '../services/pagesService.js';
import { duesService } from '../services/duesService.js';

export class InvolvementController extends BaseController {
  async classes(request, reply) {
    const classesGrouped = await classesService.getClassesGroupedByRegion();

    await this.render(request, reply, 'pages/involvement/classes.njk', {
      pageTitle: 'Classes',
      pageSubtitle: 'Swordfighting Training Classes Near You',
      classesGrouped,
    });
  }

  async etiquetteRules(request, reply) {
    // Load the main etiquette & rules page content
    const page = await pagesService.getPageBySlug('wcos-etiquette-rules');
    const threeRules = await pagesService.getPageBySlug('three-rules-of-swordsmanship');
    const sixTraditions = await pagesService.getPageBySlug('six-traditions');
    const wcosRules = await pagesService.getPageBySlug('wcos-rules');
    const westernCircleRules = await pagesService.getPageBySlug('western-circle-swordfighters-rules');
    const kaidensRules = await pagesService.getPageBySlug('western-circle-kaidens-rules');
    const eventHostingRules = await pagesService.getPageBySlug('event-hosting-rules');
    const eventRules = await pagesService.getPageBySlug('event-rules');
    const combatRules = await pagesService.getPageBySlug('combat-rules');

    await this.render(request, reply, 'pages/involvement/etiquette-rules.njk', {
      pageTitle: 'WCoS Etiquette & Rules',
      page: page || { content: '' },
      threeRules: threeRules || { content: '' },
      sixTraditions: sixTraditions || { content: '' },
      wcosRules: wcosRules || { content: '' },
      westernCircleRules: westernCircleRules || { content: '' },
      kaidensRules: kaidensRules || { content: '' },
      eventHostingRules: eventHostingRules || { content: '' },
      eventRules: eventRules || { content: '' },
      combatRules: combatRules || { content: '' },
    });
  }

  async dues(request, reply) {
    const dues = await duesService.getDefaultDues();

    await this.render(request, reply, 'pages/involvement/dues.njk', {
      pageTitle: 'Dues',
      pageSubtitle: 'Stay Eligible For Sparring & Events',
      dues: dues || {
        amount: 50,
        currency: 'USD',
        description: 'Annual dues for active members',
      },
    });
  }
}

export const involvementController = new InvolvementController();