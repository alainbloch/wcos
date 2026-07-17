/**
 * Dues Service
 * Handles dues/donations
 */
import { duesRepo } from '../models/database.js';

export class DuesService {
  async getAllDues() {
    return duesRepo.findAll();
  }

  async getActiveDues() {
    return duesRepo.findActive();
  }

  async getDuesById(id) {
    return duesRepo.findById(id);
  }

  async getDefaultDues() {
    const dues = await this.getActiveDues();
    return dues[0] || null;
  }

  async createDues(data) {
    return duesRepo.create(data);
  }

  async updateDues(id, data) {
    return duesRepo.update(id, data);
  }

  async deleteDues(id) {
    return duesRepo.delete(id);
  }
}

export const duesService = new DuesService();