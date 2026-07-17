/**
 * Champion Service
 * Handles Hall of Heroes champions
 */
import { championsRepo } from '../models/database.js';

export class ChampionService {
  async getAllChampions() {
    return championsRepo.findAllSorted();
  }

  async getChampionByYear(year) {
    return championsRepo.findByYear(year);
  }

  async getChampionById(id) {
    return championsRepo.findById(id);
  }

  async createChampion(data) {
    return championsRepo.create(data);
  }

  async updateChampion(id, data) {
    return championsRepo.update(id, data);
  }

  async deleteChampion(id) {
    return championsRepo.delete(id);
  }

  async getChampionsGroupedByDecade() {
    const champions = await this.getAllChampions();
    const grouped = {};

    for (const champion of champions) {
      const decade = Math.floor(champion.year / 10) * 10;
      const decadeKey = `${decade}s`;
      if (!grouped[decadeKey]) {
        grouped[decadeKey] = [];
      }
      grouped[decadeKey].push(champion);
    }

    return grouped;
  }
}

export const championService = new ChampionService();