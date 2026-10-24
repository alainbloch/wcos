/**
 * Member Service
 * Handles member profiles and rankings
 */
import { membersRepo } from '../models/database.js';

export class MemberService {
  async getAllMembers() {
    return membersRepo.findAll();
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

  async createMember(data) {
    return membersRepo.create(data);
  }

  async updateMember(id, data) {
    return membersRepo.update(id, data);
  }

  async deleteMember(id) {
    return membersRepo.delete(id);
  }

  async getMembersGroupedByLevel() {
    const members = await this.getAllMembers();
    const grouped = {};

    for (const member of members) {
      const level = member.level || 'Unknown';
      if (!grouped[level]) {
        grouped[level] = [];
      }
      grouped[level].push(member);
    }

    // Sort levels: L7, L6, L5, L4, L3, L2, L1, then others
    const levelOrder = ['L7', 'L6', 'L5', 'L4', 'L3', 'L2', 'L1'];
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