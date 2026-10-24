/**
 * Dues Repository
 * Handles dues/donations
 */
import { BaseRepository } from './baseRepository.js';

export class DuesRepository extends BaseRepository {
  constructor() {
    super('dues');
  }

  async findActive() {
    return this.findMany({ active: true });
  }
}

export const duesRepo = new DuesRepository();