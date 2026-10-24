/**
 * Members Repository
 * Handles member profiles and rankings
 */
import { BaseRepository } from "./baseRepository.js";

import {
  councilMembers,
  currentCouncilMembers,
} from "../utils/councilMembership.js";

export class MembersRepository extends BaseRepository {
  constructor() {
    super("members");
  }

  async update(id, data) {
    const index = this.collection?.findIndex((item) => item.id === id);
    if (index === undefined || index === -1) return null;
    const previous = this.collection[index];
    const updated = {
      ...previous,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    // Reject non-serializable data before it can poison the shared database object.
    JSON.stringify(updated);
    this.collection[index] = updated;
    try {
      await this.db.write();
      return updated;
    } catch (error) {
      // A failed write must not leave the unsaved edit visible to later requests.
      if (this.collection[index] === updated) this.collection[index] = previous;
      throw error;
    }
  }

  async findCouncilMembers() {
    return councilMembers(await this.findAll());
  }
  async findCurrentCouncilMembers() {
    return currentCouncilMembers(await this.findAll());
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
