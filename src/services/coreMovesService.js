/**
 * Core Moves Service
 * Handles core moves knowledge base
 */
import { coreMovesRepo } from '../models/database.js';

export class CoreMovesService {
  async getAllCoreMoves() {
    return coreMovesRepo.findAll();
  }

  async getCoreMoveById(id) {
    return coreMovesRepo.findById(id);
  }

  async getCoreMovesByCategory(category) {
    return coreMovesRepo.findByCategory(category);
  }

  async getMoveCategories() {
    const moves = await this.getAllCoreMoves();
    const categories = [...new Set(moves.map(m => m.category).filter(Boolean))];
    return categories.sort();
  }

  async getMovesGroupedByCategory() {
    const moves = await this.getAllCoreMoves();
    const categories = await this.getMoveCategories();
    const grouped = {};

    for (const category of categories) {
      grouped[category] = moves.filter(m => m.category === category);
    }

    return grouped;
  }

  async createCoreMove(data) {
    return coreMovesRepo.create(data);
  }

  async updateCoreMove(id, data) {
    return coreMovesRepo.update(id, data);
  }

  async deleteCoreMove(id) {
    return coreMovesRepo.delete(id);
  }
}

export const coreMovesService = new CoreMovesService();