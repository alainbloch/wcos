/**
 * Kaidens Service
 * Handles Kaiden information, rules, and documents
 */
import { kaidensRepo, kaidenRulesRepo } from '../models/database.js';

export class KaidensService {
  async getAllKaidens() {
    return kaidensRepo.findAll();
  }

  async getKaidenById(id) {
    return kaidensRepo.findById(id);
  }

  async getKaidenBySlug(slug) {
    return kaidensRepo.findOne({ slug });
  }

  async getAllKaidenRules() {
    return kaidenRulesRepo.findOrdered();
  }

  async getKaidenRuleById(id) {
    return kaidenRulesRepo.findById(id);
  }

  async createKaiden(data) {
    return kaidensRepo.create(data);
  }

  async updateKaiden(id, data) {
    return kaidensRepo.update(id, data);
  }

  async deleteKaiden(id) {
    return kaidensRepo.delete(id);
  }

  async createKaidenRule(data) {
    return kaidenRulesRepo.create(data);
  }

  async updateKaidenRule(id, data) {
    return kaidenRulesRepo.update(id, data);
  }

  async deleteKaidenRule(id) {
    return kaidenRulesRepo.delete(id);
  }

  async getKaidenContent() {
    const kaidens = await this.getAllKaidens();
    const rules = await this.getAllKaidenRules();

    return {
      theWay: kaidens.find(k => k.section === 'theWay') || {},
      rules: rules,
      documents: kaidens.filter(k => k.section === 'documents'),
    };
  }
}

export const kaidensService = new KaidensService();