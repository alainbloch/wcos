/**
 * Dynamic Page Service
 * Resolves page dataSources to repositories and renders partial templates.
 */
import {
  membersRepo,
  championsRepo,
  classesRepo,
  ranksRepo,
  movesRepo,
  kaidensRepo,
  kaidenRulesRepo,
  resourcesRepo,
  duesRepo,
  siteSettingsRepo,
  navigationRepo,
  usersRepo,
} from "../models/database.js";

import { memberService } from "./memberService.js";

const repoMapping = {
  members: membersRepo,
  champions: championsRepo,
  // Compatibility data-source names now query the unified members repository.
  councilMembers: { findAll: () => memberService.getCouncilMembers() },
  currentCouncilMembers: {
    findAll: () => memberService.getCurrentCouncilMembers(),
  },
  classes: classesRepo,
  ranks: ranksRepo,
  moves: movesRepo,
  coreMoves: { findAll: async () => (await movesRepo.findAll()).filter(move => move.core) },
  dalmaterColors: {
    findAll: async () =>
      (await memberService.getAllMembers()).filter(
        (member) => member.dalmaterColorName,
      ),
  },
  kaidens: kaidensRepo,
  kaidenRules: kaidenRulesRepo,
  resources: resourcesRepo,
  dues: duesRepo,
  siteSettings: siteSettingsRepo,
  navigation: navigationRepo,
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
