import { updatesService } from './updatesService.js';
import { glossaryService } from './glossaryService.js';
import { classesService } from './classesService.js';
/**
 * Dynamic Page Service
 * Resolves page dataSources to repositories and renders partial templates.
 */
import {
  membersRepo,
  movesRepo,
  siteSettingsRepo,
  usersRepo,
} from "../models/database.js";

import { memberService } from "./memberService.js";

const repoMapping = {
  updates: { findAll: () => updatesService.getAll() },
  newsUpdates: { findAll: () => updatesService.getAll('news') },
  generalUpdates: { findAll: () => updatesService.getAll('general') },
  councilUpdates: { findAll: () => updatesService.getAll('council') },
  glossary: { findAll: () => glossaryService.getAll() },
  members: membersRepo,
  champions: { findAll: () => memberService.getChampions() },
  fallenHeroes: { findAll: () => memberService.getFallenHeroes() },
  // Compatibility data-source names now query the unified members repository.
  councilMembers: { findAll: () => memberService.getCouncilMembers() },
  currentCouncilMembers: {
    findAll: () => memberService.getCurrentCouncilMembers(),
  },
  classes: { findAll: () => classesService.getAllClasses() },
  moves: movesRepo,
  coreMoves: { findAll: async () => (await movesRepo.findAll()).filter(move => move.core) },
  dalmaterColors: {
    findAll: async () =>
      (await memberService.getAllMembers()).filter(
        (member) => member.dalmaterColorName,
      ),
  },
  siteSettings: siteSettingsRepo,
  users: usersRepo,
};

export class DynamicPageService {
  async resolveDataSources(dataSources) {
    if (!Array.isArray(dataSources) || dataSources.length === 0) return {};
    const result = {};
    for (const source of dataSources) {
      const repo = repoMapping[source];
      if (!repo) {
        result[source] = null;
        continue;
      }
      try {
        const data = await repo.findAll();
        result[source] = Array.isArray(data) ? data : [data];
      } catch (e) {
        result[source] = null;
      }
    }
    return result;
  }
}

export const dynamicPageService = new DynamicPageService();
