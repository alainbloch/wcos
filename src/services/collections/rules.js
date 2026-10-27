/** Domain rules shared by generated forms, legacy clients, and repository callers.
 * These functions transform a candidate; they never write to the database themselves.
 */
import sanitizeHtml from "sanitize-html";
import { prepareHonors } from "../../utils/memberHonors.js";
import { prepareDalmater, isKaiden } from "../../utils/memberDalmater.js";
import { sanitizeDefinition, glossaryNameKey } from "../../utils/glossary.js";
import { sanitizePageContent } from "../referenceSiteService.js";
import { readBinding } from "./render.js";

export const MOVE_TYPES = [
  "Straight Offense",
  "Offensive Defense",
  "Initiated Response",
];
const hasText = (value) => typeof value === "string" && value.trim();
function fail(field, message) {
  const error = new Error(message);
  error.fields = { [field]: message };
  throw error;
}
export function validUpdateDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}(-\d{2})?$/.test(date))
    return false;
  const full = date.length === 7 ? date + "-01" : date,
    parsed = new Date(full + "T00:00:00Z");
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === full
  );
}
export function dateLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    ...(date.length === 10 ? { day: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date((date.length === 7 ? date + "-01" : date) + "T00:00:00Z"));
}
const rules = {
  glossary(record, data, old) {
    if (!hasText(record.name) || record.name.trim().length > 200)
      fail("name", "Enter a glossary name of 1–200 characters");
    record.name = record.name.trim();
    if (
      typeof record.definition !== "string" ||
      record.definition.length > 50000
    )
      fail("definition", "Definition must be at most 50,000 characters");
    record.definition = sanitizeDefinition(record.definition);
    if (
      !sanitizeHtml(record.definition, {
        allowedTags: [],
        allowedAttributes: {},
      }).trim()
    )
      fail("definition", "Definition is required");
    if (
      (data.glossary || []).some(
        (row) =>
          row.id !== old?.id &&
          glossaryNameKey(row.name) === glossaryNameKey(record.name),
      )
    )
      fail("name", "A glossary item with that name already exists");
    return record;
  },
  updates(record, _data, old) {
    if (!["general", "council", "news"].includes(record.category))
      fail("category", "Choose General Update, Council, or News.");
    if (!validUpdateDate(record.date))
      fail(
        "date",
        "Enter a valid date as YYYY-MM-DD or YYYY-MM for a month-only date.",
      );
    for (const [key, max] of [
      ["title", 200],
      ["subcategory", 100],
      ["pageLink", 200],
      ["image", 500],
      ["body", 200000],
    ])
      if (
        record[key] != null &&
        (typeof record[key] !== "string" || record[key].length > max)
      )
        fail(key, `${key} must be at most ${max} characters.`);
    record.body = sanitizePageContent(record.body || "");
    if (
      !sanitizeHtml(record.body, {
        allowedTags: [],
        allowedAttributes: {},
      }).trim()
    )
      fail("body", "Update body is required.");
    record.dateLabel =
      old?.date === record.date
        ? old.dateLabel || dateLabel(record.date)
        : dateLabel(record.date);
    return record;
  },
  classes(record, data) {
    if (!hasText(record.name)) fail("name", "Class name is required");
    if (
      record.instructorIds !== undefined &&
      (!Array.isArray(record.instructorIds) ||
        record.instructorIds.some(
          (id) => !(data.members || []).some((m) => m.id === id && isKaiden(m)),
        ))
    )
      fail(
        "instructorIds",
        "Choose instructors with Kaiden, Honorary Kaiden, or Head Kaiden merits",
      );
    return record;
  },
  moves(record, data, old) {
    if (!hasText(record.name)) fail("name", "Move name is required");
    if (
      record.types !== undefined &&
      (!Array.isArray(record.types) ||
        record.types.some((type) => !MOVE_TYPES.includes(type)))
    )
      fail("types", "Choose valid move types");
    if (
      record.creatorId &&
      !(data.members || []).some((m) => m.id === record.creatorId)
    )
      fail("creatorId", "Choose an existing member as creator");
    if (
      record.media !== undefined &&
      (!Array.isArray(record.media) ||
        record.media.length > 100 ||
        record.media.some(
          (item) =>
            !item ||
            !["image", "video"].includes(item.type) ||
            typeof item.url !== "string" ||
            !/^(https?:\/\/[^\s]+|\/uploads\/[a-zA-Z0-9_.-]+)$/.test(item.url),
        ))
    )
      fail(
        "media",
        "Media must use an image or video with an HTTP(S) URL or uploaded file",
      );
    record.order ??=
      old?.order ??
      Math.max(-1, ...(data.moves || []).map((m) => m.order ?? 0)) + 1;
    return record;
  },
  members(record, data, old, submitted) {
    record = prepareHonors(record, data.members || [], old?.id);
    if (
      !old ||
      [
        "dalmaterMode",
        "dalmaterKaidenId",
        "dalmaterColorName",
        "dalmaterColorHex",
      ].some((key) => Object.hasOwn(submitted, key))
    )
      record = prepareDalmater(record, data.members || [], old?.id);
    for (const field of ["level", "steelRank"])
      if (record[field] && !/^L[1-7]$/.test(record[field]))
        fail(field, "Select a valid level or steel rank");
    if (
      record.level &&
      (!old || record.level !== old.level || record.steelRank !== old.steelRank)
    ) {
      record.steelRank ||= record.level;
      record.circleName =
        record.level === record.steelRank
          ? record.level
          : `${record.level} - ${record.steelRank.toLowerCase()}`;
    }
    if (record.biography != null)
      record.biography = sanitizeHtml(record.biography);
    return record;
  },
  pages(record, data, old) {
    if (!hasText(record.title) || record.title.length > 180)
      fail("title", "Enter a page title of 1–180 characters.");
    record.title = record.title.trim();
    record.slug =
      old?.slug === "" && record.slug === ""
        ? ""
        : record.slug ||
          record.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
    if (record.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug))
      fail(
        "slug",
        "Use lowercase letters, numbers, and hyphens in the page address.",
      );
    if (
      [
        "admin",
        "api",
        "login",
        "logout",
        "register",
        "search",
        "health",
        "photo-gallery",
        "contact-us",
        "previous-updates",
      ].includes(record.slug) &&
      old?.slug !== record.slug
    )
      fail("slug", "That address is reserved. Choose another page address.");
    if (
      (data.pages || []).some((p) => p.id !== old?.id && p.slug === record.slug)
    )
      fail(
        "slug",
        "A page already uses that address. Choose a unique address.",
      );
    record.content ??= "";
    record.dataSources ??= [];
    record.dataView = readBinding(record, old?.dataView);
    if (record.parentSlug) {
      const visited = new Set([record.slug]);
      let slug = record.parentSlug;
      while (slug) {
        if (visited.has(slug))
          fail("parentSlug", "Page hierarchy contains a cycle.");
        visited.add(slug);
        const parent = (data.pages || []).find((p) => p.slug === slug);
        if (!parent) fail("parentSlug", "Parent page does not exist.");
        slug = parent.parentSlug;
      }
    }
    return record;
  },
};
export function prepareRecord(
  collection,
  record,
  data,
  old,
  submitted = record,
) {
  return rules[collection]
    ? rules[collection]({ ...record }, data, old, submitted)
    : record;
}
export function afterWrite(collection, data) {
  if (collection === "members") data.memberRosterManaged = true;
}
export function validateDeletion(collection, id, data) {
  if (collection === "members") {
    if (
      (data.classes || []).some((row) => row.instructorIds?.includes(id)) ||
      (data.moves || []).some((row) => row.creatorId === id)
    )
      throw new Error(
        "Member is referenced by a class or move. Remove those relationships first.",
      );
  }
  if (collection === "pages") {
    const page = (data.pages || []).find((p) => p.id === id);
    if (
      page &&
      (data.pages || []).some((p) => p.parentSlug && p.parentSlug === page.slug)
    )
      throw new Error("Page has child pages. Reassign them first.");
  }
}
