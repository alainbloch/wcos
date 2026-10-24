/**
 * Ranks Service
 * Handles rank requirements (Primary and Steel ranks)
 */
import { ranksRepo } from '../models/database.js';

export class RanksService {
  async getAllRanks() {
    return ranksRepo.findAll();
  }

  async getRanksByType(type) {
    return ranksRepo.findByType(type);
  }

  async getRankByLevel(level) {
    return ranksRepo.findByLevel(level);
  }

  async getPrimaryRanks() {
    return this.getRanksByType('primary');
  }

  async getSteelRanks() {
    return this.getRanksByType('steel');
  }

  async createRank(data) {
    return ranksRepo.create(data);
  }

  async updateRank(id, data) {
    return ranksRepo.update(id, data);
  }

  async deleteRank(id) {
    return ranksRepo.delete(id);
  }

  async getRanksOrderedByLevel(type) {
    const ranks = await this.getRanksByType(type);
    return ranks.sort((a, b) => {
      const aLevel = parseInt(a.level?.replace('L', '') || '0', 10);
      const bLevel = parseInt(b.level?.replace('L', '') || '0', 10);
      return aLevel - bLevel;
    });
  }
}

export const ranksService = new RanksService();