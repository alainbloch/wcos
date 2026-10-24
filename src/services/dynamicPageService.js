/**
 * Dynamic Page Service
 * Resolves page dataSources to repositories and renders partial templates.
 */
import {
  membersRepo,
  championsRepo,
  councilMembersRepo,
  classesRepo,
  ranksRepo,
  coreMovesRepo,
  dalmaterColorsRepo,
  kaidensRepo,
  kaidenRulesRepo,
  resourcesRepo,
  duesRepo,
  siteSettingsRepo,
  navigationRepo,
  usersRepo,
} from "../models/database.js";

import { renderView } from "../utils/viewEngine.js";

const repoMapping = {
  members: membersRepo,
  champions: championsRepo,
  councilMembers: councilMembersRepo,
  classes: classesRepo,
  ranks: ranksRepo,
  coreMoves: coreMovesRepo,
  dalmaterColors: dalmaterColorsRepo,
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
