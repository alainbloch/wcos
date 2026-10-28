import { viewService } from "./collections/views.js";
import { collectionStore } from "./collections/store.js";
import { updatesService } from "./updatesService.js";
import { glossaryService } from "./glossaryService.js";
import { classesService } from "./classesService.js";
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
  newsUpdates: { findAll: () => updatesService.getAll("news") },
  generalUpdates: { findAll: () => updatesService.getAll("general") },
  councilUpdates: { findAll: () => updatesService.getAll("council") },
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
  coreMoves: {
    findAll: async () =>
      (await movesRepo.findAll()).filter((move) => move.core),
  },
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
  /** Resolve collection-backed data sources modelled as relationship fields on the Pages
   * schema. Each selected record ID is looked up in its target collection and exposed under
   * the relationship field name (e.g. `members`, `updates`), preserving the binding semantics
   * page templates already rely on. */
  async resolveRelationships(page = {}) {
    let definition;
    try {
      definition = collectionStore.definition("pages");
    } catch {
      return {};
    }
    const rows = new Map();
    const result = {};
    for (const field of definition.fields) {
      if (field.type !== "relationship") continue;
      const ids = Array.isArray(page[field.name])
        ? page[field.name]
        : typeof page[field.name] === "string"
          ? page[field.name].split(",").map((s) => s.trim()).filter(Boolean)
          : [];
      if (!ids.length) continue;
      let target;
      try {
        target = collectionStore.rows(field.target);
      } catch {
        continue;
      }
      // Record the whole target once per collection to honour the stored order of selection.
      if (!rows.has(field.target)) rows.set(field.target, target);
      result[field.name] = ids
        .map((id) => rows.get(field.target).find((row) => row.id === id))
        .filter(Boolean);
    }
    return result;
  }

  async resolveDataSources(dataSources, query = {}) {
    if (!Array.isArray(dataSources) || dataSources.length === 0) return {};
    const result = {};
    for (const source of dataSources) {
      if (
        typeof source !== "string" ||
        ["__proto__", "constructor", "prototype", "users"].includes(source)
      )
        continue;
      if (source.startsWith("view:")) {
        const id = source.slice(5);
        // Data views bind the full matching record set (the page template handles
        // layout and pagination); the auto-rendered component pagination is gone.
        const resolved = viewService.run(id, query, {
          publicOnly: true,
          all: true,
        });
        result[id] = resolved.records;
        continue;
      }
      const repo = Object.hasOwn(repoMapping, source)
        ? repoMapping[source]
        : null;
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
