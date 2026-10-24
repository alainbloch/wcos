/**
 * Pages Service
 * Handles general CMS pages
 */
import { pagesRepo } from '../models/database.js';

export class PagesService {
  async getAllPages() {
    return pagesRepo.findAll();
  }

  async getPublishedPages() {
    return pagesRepo.findPublished();
  }

  async getPageById(id) {
    return pagesRepo.findById(id);
  }

  async getPageBySlug(slug) {
    return pagesRepo.findBySlug(slug);
  }

  async createPage(data) {
    const slug = data.slug || this.generateSlug(data.title);
    return pagesRepo.create({ ...data, slug });
  }

  async updatePage(id, data) {
    if (data.title && data.slug === undefined) {
      data.slug = this.generateSlug(data.title);
    }
    return pagesRepo.update(id, data);
  }

  async deletePage(id) {
    return pagesRepo.delete(id);
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}

export const pagesService = new PagesService();