/**
 * Core Moves Repository
 * Handles core moves knowledge base
 */
import { BaseRepository } from './baseRepository.js';

export class CoreMovesRepository extends BaseRepository {
  constructor() {
    super('coreMoves');
  }

  async findByCategory(category) {
    return this.findMany({ category });
  }
}

export const coreMovesRepo = new CoreMovesRepository();