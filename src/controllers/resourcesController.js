/**
 * Resources Controller
 * Handles Links & Resources, Contact Us, Previous Updates
 */
import { BaseController } from './baseController.js';
import { resourcesService } from '../services/resourcesService.js';
import { pagesService } from '../services/pagesService.js';

export class ResourcesController extends BaseController {
  async linksResources(request, reply) {
    const resourcesGrouped = await resourcesService.getResourcesGroupedByCategory();
    const categories = await resourcesService.getResourceCategories();

    await this.render(request, reply, 'pages/resources/links-resources.njk', {
      pageTitle: 'Links & Resources',
      pageSubtitle: 'Best Sword Fighting Links & Resources',
      resourcesGrouped,
      categories,
    });
  }

  async contactUs(request, reply) {
    const page = await pagesService.getPageBySlug('contact-us');

    await this.render(request, reply, 'pages/resources/contact-us.njk', {
      pageTitle: 'Contact Us',
      page: page || {
        content: '',
        email: 'westerncouncil@gmail.com',
        address: 'DOJOS IN CA, OR, WA, NV AND KY',
      },
    });
  }

  async previousUpdates(request, reply) {
    const page = await pagesService.getPageBySlug('previous-updates');

    await this.render(request, reply, 'pages/resources/previous-updates.njk', {
      pageTitle: 'Previous Updates',
      page: page || { content: '' },
    });
  }
}

export const resourcesController = new ResourcesController();