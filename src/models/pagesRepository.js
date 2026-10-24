/**
 * Pages Repository
 * Handles CMS pages
 */
import { BaseRepository } from './baseRepository.js';

export class PagesRepository extends BaseRepository {
  constructor() {
    super('pages');
  }

  async findBySlug(slug) {
    return this.findOne({ slug });
  }

  async findPublished() {
    return this.findMany({ published: true });
  }
}

export const pagesRepo = new PagesRepository();