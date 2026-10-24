/**
 * Resources Service
 * Handles Links & Resources
 */
import { resourcesRepo } from '../models/database.js';

export class ResourcesService {
  async getAllResources() {
    return resourcesRepo.findAll();
  }

  async getResourceById(id) {
    return resourcesRepo.findById(id);
  }

  async getResourcesByCategory(category) {
    return resourcesRepo.findByCategory(category);
  }

  async getResourceCategories() {
    const resources = await this.getAllResources();
    const categories = [...new Set(resources.map(r => r.category).filter(Boolean))];
    return categories.sort();
  }

  async getResourcesGroupedByCategory() {
    const resources = await this.getAllResources();
    const categories = await this.getResourceCategories();
    const grouped = {};

    for (const category of categories) {
      grouped[category] = resources.filter(r => r.category === category);
    }

    return grouped;
  }

  async createResource(data) {
    return resourcesRepo.create(data);
  }

  async updateResource(id, data) {
    return resourcesRepo.update(id, data);
  }

  async deleteResource(id) {
    return resourcesRepo.delete(id);
  }
}

export const resourcesService = new ResourcesService();