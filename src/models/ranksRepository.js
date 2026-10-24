/**
 * Ranks Repository
 * Handles rank requirements (Primary and Steel ranks)
 */
import { BaseRepository } from './baseRepository.js';

export class RanksRepository extends BaseRepository {
  constructor() {
    super('ranks');
  }

  async findByType(type) {
    return this.findMany({ type });
  }

  async findByLevel(level) {
    return this.findOne({ level });
  }
}

export const ranksRepo = new RanksRepository();