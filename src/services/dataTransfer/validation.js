import {
  validateState,
  emptyState,
  definitionsOf,
} from "../collections/store.js";
import { FORMAT, VERSION } from "./format.js";
import { validUpdateDate } from "../updatesService.js";
import { renderLayoutTemplate, layoutContext } from "../layoutService.js";
import { isKaiden } from "../../utils/memberDalmater.js";

export const COLLECTIONS = [
  "pages",
  "members",
  "classes",
  "glossary",
  "updates",
  "moves",
  "siteSettings",
  "users",
];
export const MODES = ["populate", "override", "restore"];
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string";
export function snapshotOf(data) {
  const unknown = Object.keys(data).filter(
    (key) =>
      !COLLECTIONS.includes(key) &&
      ![
        "dynamic",
        "migrations",
        "referenceMigrationVersion",
        "honorsMigrationReview",
        "memberRosterManaged",
        "resources",
      ].includes(key),
  );
  if (unknown.length)
    throw new Error(
      `Unsupported database collections: ${unknown.join(", ")}. Update the exporter before proceeding.`,
    );
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    collections: Object.fromEntries(
      COLLECTIONS.map((key) => [key, structuredClone(data[key] || [])]),
    ),
    system: {
      ...(data.dynamic ? { dynamic: structuredClone(data.dynamic) } : {}),
      // Retired resources remain recoverable without exposing a removed CMS collection.
      ...(data.resources !== undefined
        ? { resources: structuredClone(data.resources) }
        : {}),
      ...(data.memberRosterManaged !== undefined
        ? { memberRosterManaged: data.memberRosterManaged }
        : {}),
      migrations: structuredClone(data.migrations || {}),
      referenceMigrationVersion: data.referenceMigrationVersion || 1,
      honorsMigrationReview: structuredClone(data.honorsMigrationReview || []),
    },
  };
}
export function inspectSnapshot(snapshot, mode) {
  const errors = [];
  if (
    !object(snapshot) ||
    snapshot.format !== FORMAT ||
    snapshot.version !== VERSION
  )
    return ["Unsupported data format/version. Export a version 1 WCOS backup."];
  if (!MODES.includes(mode))
    errors.push("Select Populate, Override, or Restore.");
  if (!object(snapshot.collections))
    return [...errors, "collections must be an object."];
  if (
    snapshot.system !== undefined &&
    (!object(snapshot.system) ||
      (snapshot.system.honorsMigrationReview !== undefined &&
        !Array.isArray(snapshot.system.honorsMigrationReview)) ||
      (snapshot.system.memberRosterManaged !== undefined &&
        typeof snapshot.system.memberRosterManaged !== "boolean") ||
      (snapshot.system.resources !== undefined &&
        !Array.isArray(snapshot.system.resources)))
  )
    errors.push("Invalid system metadata.");
  if (snapshot.system?.dynamic) {
    try {
      validateState({
        ...snapshot.collections,
        dynamic: snapshot.system.dynamic,
      });
    } catch (error) {
      errors.push(error.message);
    }
  }
  for (const key of Object.keys(snapshot.collections))
    if (!COLLECTIONS.includes(key)) errors.push(`Unknown collection: ${key}`);
  for (const key of COLLECTIONS) {
    const rows = snapshot.collections[key];
    if (rows === undefined) {
      if (mode === "restore")
        errors.push(`${key}: required for a full restore.`);
      continue;
    }
    if (!Array.isArray(rows)) {
      errors.push(`${key}: expected an array.`);
      continue;
    }
    if (rows.length > 50000) {
      errors.push(`${key}: too many records.`);
      continue;
    }
    const ids = new Set();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (
        !object(row) ||
        !text(row.id) ||
        !row.id.trim() ||
        row.id.length > 200
      ) {
        errors.push(`${key}[${i}].id: a non-empty string is required.`);
        continue;
      }
      if (ids.has(row.id)) errors.push(`${key}[${row.id}].id: duplicate ID.`);
      ids.add(row.id);
    }
  }
  return errors.slice(0, 1000);
}
export function mergeCollections(current, incoming, mode) {
  const result = structuredClone(current),
    counts = [];
  for (const key of COLLECTIONS) {
    if (mode !== "restore" && incoming.collections[key] === undefined) continue;
    const existing = current[key] || [],
      rows = incoming.collections[key] || [];
    // Site settings are a singleton: backups from another installation can have a different ID.
    const map = new Map(existing.map((row) => [row.id, structuredClone(row)]));
    let added = 0,
      replaced = 0,
      skipped = 0;
    if (mode === "restore") {
      result[key] = structuredClone(rows);
      for (const row of rows) map.has(row.id) ? replaced++ : added++;
    } else if (key === "siteSettings" && rows.length && existing.length) {
      if (mode === "override") {
        result[key] = structuredClone(rows);
        replaced = 1;
      } else skipped = 1;
    } else {
      for (const row of rows) {
        if (map.has(row.id)) {
          if (mode === "populate") {
            skipped++;
            continue;
          }
          replaced++;
        } else added++;
        map.set(row.id, structuredClone(row));
      }
      result[key] = [...map.values()];
    }
    counts.push({
      collection: key,
      added,
      replaced,
      skipped,
      removed:
        mode === "restore"
          ? existing.filter((old) => !rows.some((row) => row.id === old.id))
              .length
          : 0,
      total: result[key].length,
    });
  }
  // Preserve app migration markers so intentionally empty collections stay empty after restart.
  result.migrations = {
    ...current.migrations,
    classesInstructors: true,
    memberHonors: true,
    glossary: true,
    updates: true,
    editableLayout: true,
  };
  const importedReview = incoming.system?.honorsMigrationReview || [];
  result.honorsMigrationReview =
    mode === "restore"
      ? structuredClone(importedReview)
      : [
          ...new Map(
            [...(current.honorsMigrationReview || []), ...importedReview].map(
              (item) => [JSON.stringify(item), item],
            ),
          ).values(),
        ];
  // A managed empty roster must not fall back to the original imported names.
  result.memberRosterManaged =
    mode === "restore"
      ? (incoming.system?.memberRosterManaged ?? true)
      : Boolean(
          current.memberRosterManaged ||
          incoming.system?.memberRosterManaged ||
          incoming.collections.members !== undefined,
        );
  if (incoming.system?.resources !== undefined) {
    result.resources =
      mode === "restore"
        ? structuredClone(incoming.system.resources)
        : [
            ...new Map(
              [...(current.resources || []), ...incoming.system.resources].map(
                (item) => [JSON.stringify(item), structuredClone(item)],
              ),
            ).values(),
          ];
  } else if (mode === "restore") {
    delete result.resources;
  }
  if (incoming.system?.dynamic) {
    const previous = current.dynamic || emptyState(),
      next = incoming.system.dynamic;
    if (mode === "restore") result.dynamic = structuredClone(next);
    else {
      const merge = (old, rows) => [
        ...new Map(
          (mode === "populate" ? [...rows, ...old] : [...old, ...rows]).map(
            (row) => [row.id, structuredClone(row)],
          ),
        ).values(),
      ];
      result.dynamic = {
        definitions: merge(previous.definitions, next.definitions),
        views: merge(previous.views, next.views),
        history: previous.history,
        records: Object.fromEntries(
          [
            ...new Set([
              ...Object.keys(previous.records),
              ...Object.keys(next.records),
            ]),
          ].map((id) => [
            id,
            merge(previous.records[id] || [], next.records[id] || []),
          ]),
        ),
      };
    }
  } else if (mode === "restore") delete result.dynamic;
  result.referenceMigrationVersion = 1;
  return { result, counts };
}
export function validateDatabase(data) {
  const errors = [];
  try {
    validateState(data);
  } catch (error) {
    errors.push(error.message);
  }
  const fail = (key, row, field, message) => {
    if (errors.length < 1000)
      errors.push(`${key}[${row.id}].${field}: ${message}`);
  };
  const schemas = definitionsOf(data);
  const required = {
    pages: ["title", "slug", "content"],
    members: ["position"],
    classes: ["name"],
    glossary: ["name", "definition"],
    updates: ["date", "category", "body"],
    moves: ["name"],
    siteSettings: ["siteName"],
    users: ["email", "name", "password"],
  };
  const stringFields = [
    "title",
    "name",
    "slug",
    "content",
    "position",
    "definition",
    "date",
    "dateLabel",
    "category",
    "subcategory",
    "pageLink",
    "body",
    "email",
    "password",
    "description",
    "image",
    "creatorId",
    "parentSlug",
    "dalmaterKaidenId",
    "siteName",
    "biography",
    "region",
    "schedule",
    "location",
    "details",
    "councilRole",
    "councilTitle",
    "councilTermStart",
    "councilTermEnd",
    "councilHistoricalDate",
  ];
  const boolFields = [
    "published",
    "active",
    "core",
    "fallenHero",
    "councilCurrent",
  ];
  for (const key of COLLECTIONS)
    for (const row of data[key] || []) {
      for (const field of schemas.find((schema) => schema.id === key)?.fields ||
        []) {
        const value = row[field.name];
        if (
          field.options?.length &&
          value != null &&
          value !== "" &&
          (Array.isArray(value) ? value : [value]).some(
            (item) => !field.options.includes(item),
          )
        )
          fail(key, row, field.name, "unknown schema choice.");
      }
      for (const field of required[key])
        if (
          !text(row[field]) ||
          (!["slug", "content"].includes(field) && !row[field].trim())
        )
          fail(key, row, field, "required text.");
      for (const field of stringFields)
        if (
          row[field] !== undefined &&
          row[field] !== null &&
          !text(row[field])
        )
          fail(key, row, field, "must be text.");
      for (const field of boolFields)
        if (row[field] !== undefined && typeof row[field] !== "boolean")
          fail(key, row, field, "must be true or false.");
      for (const field of ["createdAt", "updatedAt"])
        if (
          row[field] !== undefined &&
          (!text(row[field]) || Number.isNaN(Date.parse(row[field])))
        )
          fail(key, row, field, "invalid timestamp.");
      for (const field of ["merits", "dataSources", "instructorIds", "types"])
        if (
          row[field] !== undefined &&
          (!Array.isArray(row[field]) ||
            row[field].some((value) => !text(value)))
        )
          fail(key, row, field, "must be an array of strings.");
      if (key === "updates" && !validUpdateDate(row.date))
        fail(key, row, "date/category", "invalid date or category.");
      if (
        key === "users" &&
        (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email || "") ||
          !/^\$2[aby]\$(0[4-9]|1[0-6])\$[./A-Za-z0-9]{53}$/.test(
            row.password || "",
          ))
      )
        fail(
          key,
          row,
          "credentials",
          "valid email and bcrypt hash required; plaintext passwords are never accepted.",
        );
      if (key === "moves") {
        if (
          row.order !== undefined &&
          (!Number.isInteger(row.order) || row.order < 0)
        )
          fail(key, row, "order", "must be a non-negative integer.");
        if (
          row.media !== undefined &&
          (!Array.isArray(row.media) ||
            row.media.some(
              (media) =>
                !object(media) ||
                !["image", "video"].includes(media.type) ||
                !text(media.url) ||
                !/^(https?:\/\/|\/uploads\/)/.test(media.url),
            ))
        )
          fail(key, row, "media", "expected an array of image/video URLs.");
      }
    }
  if (!data.users?.length)
    errors.push(
      "users: at least one usable administrator account is required.",
    );
  if (data.siteSettings?.length !== 1)
    errors.push("siteSettings: exactly one settings record is required.");
  for (const [key, field, normalize] of [
    ["pages", "slug", (v) => v],
    ["users", "email", (v) => v.trim().toLowerCase()],
    ["glossary", "name", (v) => v.trim().toLowerCase()],
  ]) {
    const seen = new Set();
    for (const row of data[key] || []) {
      if (!text(row[field])) continue;
      const value = normalize(row[field]);
      if (seen.has(value))
        fail(key, row, field, "duplicate value in resulting database.");
      seen.add(value);
    }
  }
  const members = new Map((data.members || []).map((row) => [row.id, row]));
  const slugs = new Set((data.pages || []).map((row) => row.slug));
  const years = new Set();
  for (const member of data.members || []) {
    if (member.dalmaterKaidenId && !members.has(member.dalmaterKaidenId))
      fail(
        "members",
        member,
        "dalmaterKaidenId",
        "referenced member does not exist.",
      );
    if (member.championships !== undefined) {
      if (!Array.isArray(member.championships)) {
        fail("members", member, "championships", "must be an array.");
        continue;
      }
      for (const award of member.championships) {
        if (
          !object(award) ||
          !Number.isInteger(award.year) ||
          award.year < 1000 ||
          award.year > 9999 ||
          years.has(award.year)
        )
          fail(
            "members",
            member,
            "championships",
            "invalid or duplicate championship year.",
          );
        else years.add(award.year);
      }
    }
  }
  for (const row of data.classes || [])
    if (Array.isArray(row.instructorIds))
      for (const id of row.instructorIds)
        if (!members.has(id) || !isKaiden(members.get(id)))
          fail(
            "classes",
            row,
            "instructorIds",
            `instructor ${id} must reference an eligible Kaiden member.`,
          );
  for (const row of data.moves || [])
    if (row.creatorId && !members.has(row.creatorId))
      fail("moves", row, "creatorId", "referenced member does not exist.");
  for (const row of data.pages || [])
    if (row.parentSlug && !slugs.has(row.parentSlug))
      fail("pages", row, "parentSlug", "parent page does not exist.");
  const bySlug = new Map((data.pages || []).map((row) => [row.slug, row]));
  for (const row of data.pages || []) {
    const visited = new Set([row.slug]);
    let parent = row.parentSlug;
    while (parent) {
      if (visited.has(parent)) {
        fail("pages", row, "parentSlug", "page hierarchy contains a cycle.");
        break;
      }
      visited.add(parent);
      parent = bySlug.get(parent)?.parentSlug;
    }
  }
  const settings = data.siteSettings?.[0];
  if (settings?.referenceLayout) {
    if (!object(settings.referenceLayout))
      fail("siteSettings", settings, "referenceLayout", "must be an object.");
    else
      for (const section of ["header", "footer", "css"]) {
        const source = settings.referenceLayout[section];
        if (!text(source))
          fail(
            "siteSettings",
            settings,
            `referenceLayout.${section}`,
            "must be text.",
          );
        else if (section !== "css") {
          try {
            renderLayoutTemplate(source, layoutContext(settings));
          } catch {
            fail(
              "siteSettings",
              settings,
              `referenceLayout.${section}`,
              "invalid template.",
            );
          }
        }
      }
  }
  return errors;
}
