/**
 * Dalmater Colors Service
 * Handles dalmater colors and Kaiden color assignments
 */
import { dalmaterColorsRepo } from '../models/database.js';

export class DalmaterColorsService {
  async getAllDalmaterColors() {
    return dalmaterColorsRepo.findAll();
  }

  async getDalmaterColorById(id) {
    return dalmaterColorsRepo.findById(id);
  }

  async getDalmaterColorByKaiden(kaiden) {
    return dalmaterColorsRepo.findByKaiden(kaiden);
  }

  async getActiveDalmaterColors() {
    const colors = await this.getAllDalmaterColors();
    return colors.filter(c => c.active !== false);
  }

  async getKaidensWithColors() {
    const colors = await this.getActiveDalmaterColors();
    return colors
      .filter(c => c.kaiden && c.color)
      .sort((a, b) => (a.kaidenOrder || 0) - (b.kaidenOrder || 0));
  }

  async getRedDalmaterInfo() {
    const colors = await this.getAllDalmaterColors();
    return colors.find(c => c.isRedDalmater === true) || null;
  }

  async createDalmaterColor(data) {
    return dalmaterColorsRepo.create(data);
  }

  async updateDalmaterColor(id, data) {
    return dalmaterColorsRepo.update(id, data);
  }

  async deleteDalmaterColor(id) {
    return dalmaterColorsRepo.delete(id);
  }
}

export const dalmaterColorsService = new DalmaterColorsService();