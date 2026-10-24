/**
 * Members Repository
 * Handles member profiles and rankings
 */
import { BaseRepository } from './baseRepository.js';

export class MembersRepository extends BaseRepository {
  constructor() {
    super('members');
  }

  async findByLevel(level) {
    return this.findMany({ level });
  }

  async findActive() {
    return this.findMany({ active: true });
  }

  async findByRegion(region) {
    return this.findMany({ region });
  }
}

export const membersRepo = new MembersRepository();