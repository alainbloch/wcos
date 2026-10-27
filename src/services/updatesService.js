import { updatesRepo } from "../models/database.js";
import { sanitizePageContent } from "./referenceSiteService.js";
import sanitizeHtml from "sanitize-html";
export function readUpdateForm(body = {}) {
  return Object.fromEntries(
    ["title", "date", "category", "subcategory", "pageLink", "body", "image"].map((key) => [
      key,
      typeof body[key] === "string" ? body[key] : "",
    ]),
  );
}
export function dateLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    ...(date.length === 10 ? { day: "numeric" } : {}),
    timeZone: "UTC",
  }).format(
    new Date(date.length === 7 ? date + "-01T00:00:00Z" : date + "T00:00:00Z"),
  );
}
export function validUpdateDate(date) {
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(date)) return false;
  const full = date.length === 7 ? date + "-01" : date;
  const parsed = new Date(full + "T00:00:00Z");
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === full
  );
}
export class UpdatesService {
  async getAll(category) {
    return (await updatesRepo.findAll()).sort((a,b)=>b.date.localeCompare(a.date))
      .filter((item) => !category || item.category === category)
      .map((item) => ({
        ...item,
        body: sanitizePageContent(item.body),
        dateLabel: item.dateLabel || dateLabel(item.date),
      }));
  }
  async validate(body, id) {
    const data = readUpdateForm(body);
    data.title = data.title.trim();
    if (data.title.length > 200)
      throw new Error("Title must be at most 200 characters.");
    if (!["general", "council", "news"].includes(data.category))
      throw new Error("Choose General Update, Council, or News.");
    if (!validUpdateDate(data.date))
      throw new Error(
        "Enter a valid date as YYYY-MM-DD or YYYY-MM for a month-only date.",
      );
    if (data.subcategory && data.subcategory.length > 100)
      throw new Error("Subcategory must be at most 100 characters.");
    if (data.pageLink && data.pageLink.length > 200)
      throw new Error("Page link must be at most 200 characters.");
    if (data.image && data.image.length > 500)
      throw new Error("Image URL/path must be at most 500 characters.");
    if (data.body.length > 200000)
      throw new Error("Body must be at most 200,000 characters.");
    data.body = sanitizePageContent(data.body);
    if (
      !sanitizeHtml(data.body, {
        allowedTags: [],
        allowedAttributes: {},
      }).trim()
    )
      throw new Error("Update body is required.");
    const old = id ? await updatesRepo.findById(id) : null;
    data.dateLabel =
      old?.date === data.date
        ? old.dateLabel || dateLabel(data.date)
        : dateLabel(data.date);
    return data;
  }
  async create(body) {
    return updatesRepo.create(await this.validate(body));
  }
  async update(id, body) {
    return updatesRepo.update(id, await this.validate(body, id));
  }
}
export const updatesService = new UpdatesService();
