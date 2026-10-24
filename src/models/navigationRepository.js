/**
 * Navigation Repository
 * Handles site navigation structure
 */
import { BaseRepository } from './baseRepository.js';
import { defaultData } from './database.js';

export class NavigationRepository extends BaseRepository {
  constructor() {
    super('navigation');
  }

  async getNavigation() {
    const nav = await this.findAll();
    return nav[0] || defaultData.navigation;
  }

  async updateNavigation(data) {
    const nav = await this.getNavigation();
    return this.update(nav.id, data);
  }
}

export const navigationRepo = new NavigationRepository();