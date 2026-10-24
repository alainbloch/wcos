/**
 * Kaiden Rules Repository
 * Handles Kaiden rules
 */
import { BaseRepository } from './baseRepository.js';

export class KaidenRulesRepository extends BaseRepository {
  constructor() {
    super('kaidenRules');
  }

  async findOrdered() {
    const rules = await this.findAll();
    return rules.sort((a, b) => a.order - b.order);
  }
}

export const kaidenRulesRepo = new KaidenRulesRepository();