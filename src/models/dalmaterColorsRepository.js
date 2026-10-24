/**
 * Dalmater Colors Repository
 * Handles dalmater colors and Kaiden color assignments
 */
import { BaseRepository } from './baseRepository.js';

export class DalmaterColorsRepository extends BaseRepository {
  constructor() {
    super('dalmaterColors');
  }

  async findByKaiden(kaiden) {
    return this.findOne({ kaiden });
  }
}

export const dalmaterColorsRepo = new DalmaterColorsRepository();