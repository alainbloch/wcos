/**
 * Site Service
 * Handles site-wide settings and navigation
 */
import {
  siteSettingsRepo,
} from '../models/database.js';

export class SiteService {
  async getSiteSettings() {
    return siteSettingsRepo.getSettings();
  }

  async updateSiteSettings(data) {
    return siteSettingsRepo.updateSettings(data);
  }

  async getFooterData() {
    const settings = await this.getSiteSettings();

    return {
      siteName: settings.siteName,
      siteEmail: settings.siteEmail,
      dojosText: settings.dojosText,
      social: {
        facebook: 'https://facebook.com/wcos',
        instagram: 'https://instagram.com/wcos',
        youtube: 'https://youtube.com/wcos',
      },
    };
  }
}

export const siteService = new SiteService();