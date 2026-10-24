/**
 * Site Settings Repository
 * Handles site-wide settings
 */
import { BaseRepository } from './baseRepository.js';
import { defaultData } from './database.js';

export class SiteSettingsRepository extends BaseRepository {
  constructor() {
    super('siteSettings');
  }

  async getSettings() {
    const settings = await this.findAll();
    return settings[0] || defaultData.siteSettings;
  }

  async updateSettings(data) {
    const settings = await this.getSettings();
    return this.update(settings.id, data);
  }
}

export const siteSettingsRepo = new SiteSettingsRepository();