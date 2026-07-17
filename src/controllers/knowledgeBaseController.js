/**
 * Knowledge Base Controller
 * Handles Rank Requirements, Core Moves, Dalmater Colors, Kaidens, etc.
 */
import { BaseController } from './baseController.js';
import { ranksService } from '../services/ranksService.js';
import { coreMovesService } from '../services/coreMovesService.js';
import { dalmaterColorsService } from '../services/dalmaterColorsService.js';
import { kaidensService } from '../services/kaidensService.js';
import { pagesService } from '../services/pagesService.js';

export class KnowledgeBaseController extends BaseController {
  async rankRequirements(request, reply) {
    const primaryRanks = await ranksService.getRanksOrderedByLevel('primary');
    const steelRanks = await ranksService.getRanksOrderedByLevel('steel');

    await this.render(request, reply, 'pages/knowledge-base/rank-requirements.njk', {
      pageTitle: 'Rank Requirements',
      pageSubtitle: 'Trainee To Expert Swordsman',
      primaryRanks,
      steelRanks,
    });
  }

  async coreMoves(request, reply) {
    const movesByCategory = await coreMovesService.getMovesGroupedByCategory();
    const categories = await coreMovesService.getMoveCategories();
    const moveTypes = [
      {
        id: 'initiated-response',
        name: 'INITIATED RESPONSE',
        description: 'An Offensive attack that creates an opening in which you take advantage of. Example: cut high, then low, feint, then make a full cut, etc.',
      },
      {
        id: 'straight-offense',
        name: 'STRAIGHT OFFENSE',
        description: 'A single attack to a predetermined target that is usually left open. Example: a full circle cut to the head, a chop to the arm, a short circle cut to the hand, or a thrust to the face',
      },
      {
        id: 'offensive-defense',
        name: 'OFFENSIVE DEFENSE',
        description: 'An initial defensive action that directly leads to an offensive attack. Example: a side step with cut, a shuffle back followed by a shuffle in and attack, a block followed by a cut to a now exposed area, etc.',
      },
    ];

    await this.render(request, reply, 'pages/knowledge-base/core-moves.njk', {
      pageTitle: 'Core Moves',
      pageSubtitle: 'Offensive, Defensive & Advanced Techniques',
      moveTypes,
      movesByCategory,
      categories,
    });
  }

  async dalmaterColors(request, reply) {
    const kaidensWithColors = await dalmaterColorsService.getKaidensWithColors();
    const redDalmater = await dalmaterColorsService.getRedDalmaterInfo();
    const allColors = await dalmaterColorsService.getAllDalmaterColors();

    await this.render(request, reply, 'pages/knowledge-base/dalmater-colors.njk', {
      pageTitle: 'Dalmater Colors',
      pageSubtitle: 'Complete Guide To Dalmater Colors',
      kaidensWithColors,
      redDalmater,
      allColors,
    });
  }

  async kaidens(request, reply) {
    const content = await kaidensService.getKaidenContent();

    await this.render(request, reply, 'pages/knowledge-base/kaidens.njk', {
      pageTitle: 'Kaidens',
      pageSubtitle: 'The Role, Rules & Path Of A Sword Teacher',
      theWay: content.theWay,
      rules: content.rules,
      documents: content.documents,
    });
  }

  async fighterClass(request, reply) {
    const page = await pagesService.getPageBySlug('fighter-class');
    await this.render(request, reply, 'pages/knowledge-base/fighter-class.njk', {
      pageTitle: 'Fighter Class',
      page: page || { content: '' },
    });
  }

  async armor(request, reply) {
    const page = await pagesService.getPageBySlug('armor');
    await this.render(request, reply, 'pages/knowledge-base/armor.njk', {
      pageTitle: 'Armor',
      page: page || { content: '' },
    });
  }

  async weapons(request, reply) {
    const page = await pagesService.getPageBySlug('weapons');
    await this.render(request, reply, 'pages/knowledge-base/weapons.njk', {
      pageTitle: 'Weapons',
      page: page || { content: '' },
    });
  }

  async sparring(request, reply) {
    const page = await pagesService.getPageBySlug('sparring');
    await this.render(request, reply, 'pages/knowledge-base/sparring.njk', {
      pageTitle: 'Sparring',
      page: page || { content: '' },
    });
  }

  async swordDance(request, reply) {
    const page = await pagesService.getPageBySlug('sword-dance');
    await this.render(request, reply, 'pages/knowledge-base/sword-dance.njk', {
      pageTitle: 'Sword Dance',
      page: page || { content: '' },
    });
  }

  async glossary(request, reply) {
    const page = await pagesService.getPageBySlug('glossary');
    await this.render(request, reply, 'pages/knowledge-base/glossary.njk', {
      pageTitle: 'Glossary',
      page: page || { content: '' },
    });
  }
}

export const knowledgeBaseController = new KnowledgeBaseController();