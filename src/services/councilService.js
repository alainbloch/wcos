/**
 * Council Service
 * Handles WCOS Council members
 */
import { councilMembersRepo } from '../models/database.js';

export class CouncilService {
  async getAllCouncilMembers() {
    return councilMembersRepo.findAll();
  }

  async getCurrentCouncil() {
    return councilMembersRepo.findCurrent();
  }

  async getCouncilMemberById(id) {
    return councilMembersRepo.findById(id);
  }

  async createCouncilMember(data) {
    return councilMembersRepo.create(data);
  }

  async updateCouncilMember(id, data) {
    return councilMembersRepo.update(id, data);
  }

  async deleteCouncilMember(id) {
    return councilMembersRepo.delete(id);
  }
}

export const councilService = new CouncilService();