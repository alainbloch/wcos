/**
 * Site Service
 * Handles site-wide settings and navigation
 */
import {
  siteSettingsRepo,
  navigationRepo,
} from '../models/database.js';

export class SiteService {
  async getSiteSettings() {
    return siteSettingsRepo.getSettings();
  }

  async updateSiteSettings(data) {
    return siteSettingsRepo.updateSettings(data);
  }

  async getNavigation() {
    return navigationRepo.getNavigation();
  }

  async updateNavigation(data) {
    return navigationRepo.updateNavigation(data);
  }

  async getFooterData() {
    const settings = await this.getSiteSettings();
    const nav = await this.getNavigation();

    return {
      siteName: settings.siteName,
      siteEmail: settings.siteEmail,
      dojosText: settings.dojosText,
      social: {
        facebook: 'https://facebook.com/wcos',
        instagram: 'https://instagram.com/wcos',
        youtube: 'https://youtube.com/wcos',
      },
      navigation: nav,
    };
  }
}

export const siteService = new SiteService();