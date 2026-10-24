/**
 * Champions Repository
 * Handles Hall of Heroes champions
 */
import { BaseRepository } from './baseRepository.js';

export class ChampionsRepository extends BaseRepository {
  constructor() {
    super('champions');
  }

  async findByYear(year) {
    return this.findOne({ year });
  }

  async findAllSorted() {
    const champions = await this.findAll();
    return champions.sort((a, b) => b.year - a.year);
  }
}

export const championsRepo = new ChampionsRepository();