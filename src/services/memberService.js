import { prepareHonors, memberChampions, fallenHeroes } from '../utils/memberHonors.js';
/**
 * Member Service
 * Handles member profiles and rankings
 */
import { membersRepo, getDatabase } from "../models/database.js";

import {
  prepareDalmater,
  kaidenColorOptions,
} from "../utils/memberDalmater.js";

export class MemberService {
  async getChampions() { return memberChampions(await membersRepo.findAll()); }
  async getFallenHeroes() { return fallenHeroes(await membersRepo.findAll()); }

  async getKaidenColorOptions(excludeId) {
    return kaidenColorOptions(await membersRepo.findAll(), excludeId);
  }

  async getAllMembers() {
    return membersRepo.findAll();
  }

  async getCouncilMembers() {
    return membersRepo.findCouncilMembers();
  }
  async getCurrentCouncilMembers() {
    return membersRepo.findCurrentCouncilMembers();
  }

  async getMemberById(id) {
    return membersRepo.findById(id);
  }

  async getMembersByLevel(level) {
    return membersRepo.findByLevel(level);
  }

  async getActiveMembers() {
    return membersRepo.findActive();
  }

  async getMembersByRegion(region) {
    return membersRepo.findByRegion(region);
  }

  async isRosterManaged() {
    return Boolean(
      getDatabase().data.memberRosterManaged ||
      (await this.getAllMembers()).length,
    );
  }

  async markRosterManaged() {
    const db = getDatabase();
    db.data.memberRosterManaged = true;
    await db.write();
  }

  async createMember(data) {
    data = prepareHonors(data, await membersRepo.findAll());
    data = prepareDalmater(data, await membersRepo.findAll());
    await this.markRosterManaged();
    return membersRepo.create(data);
  }

  async updateMember(id, data) {
    data = prepareHonors(data, await membersRepo.findAll(), id);
    data = prepareDalmater(data, await membersRepo.findAll(), id);
    await this.markRosterManaged();
    return membersRepo.update(id, data);
  }

  async deleteMember(id) {
    await this.markRosterManaged();
    return membersRepo.delete(id);
  }

  async getMembersGroupedByLevel() {
    const members = await this.getAllMembers();
    const grouped = {};

    for (const member of members) {
      const level = member.level || "Unknown";
      if (!grouped[level]) {
        grouped[level] = [];
      }
      grouped[level].push(member);
    }

    // Sort levels: L7, L6, L5, L4, L3, L2, L1, then others
    const levelOrder = ["L7", "L6", "L5", "L4", "L3", "L2", "L1"];
    const sortedLevels = Object.keys(grouped).sort((a, b) => {
      const aIndex = levelOrder.indexOf(a);
      const bIndex = levelOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

    const result = {};
    for (const level of sortedLevels) {
      result[level] = grouped[level];
    }

    return result;
  }
}

export const memberService = new MemberService();
