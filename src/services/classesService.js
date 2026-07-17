/**
 * Classes Service
 * Handles training classes/locations
 */
import { classesRepo } from '../models/database.js';

export class ClassesService {
  async getAllClasses() {
    return classesRepo.findAll();
  }

  async getActiveClasses() {
    return classesRepo.findActive();
  }

  async getClassById(id) {
    return classesRepo.findById(id);
  }

  async createClass(data) {
    return classesRepo.create(data);
  }

  async updateClass(id, data) {
    return classesRepo.update(id, data);
  }

  async deleteClass(id) {
    return classesRepo.delete(id);
  }

  async getClassesGroupedByRegion() {
    const classes = await this.getActiveClasses();
    const grouped = {};

    for (const cls of classes) {
      const region = cls.region || 'Other';
      if (!grouped[region]) {
        grouped[region] = [];
      }
      grouped[region].push(cls);
    }

    return grouped;
  }
}

export const classesService = new ClassesService();