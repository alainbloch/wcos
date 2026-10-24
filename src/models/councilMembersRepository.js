/**
 * Council Members Repository
 * Handles WCOS Council members
 */
import { BaseRepository } from './baseRepository.js';

export class CouncilMembersRepository extends BaseRepository {
  constructor() {
    super('councilMembers');
  }

  async findCurrent() {
    return this.findMany({ current: true });
  }
}

export const councilMembersRepo = new CouncilMembersRepository();