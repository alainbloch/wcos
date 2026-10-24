/**
 * Resources Repository
 * Handles Links & Resources
 */
import { BaseRepository } from './baseRepository.js';

export class ResourcesRepository extends BaseRepository {
  constructor() {
    super('resources');
  }

  async findByCategory(category) {
    return this.findMany({ category });
  }
}

export const resourcesRepo = new ResourcesRepository();