import { viewService } from "./collections/views.js";
/**
 * Pages Service
 * Handles general CMS pages
 */
import { pagesRepo } from "../models/database.js";

export class PagesService {
  async getAllPages() {
    return pagesRepo.findAll();
  }

  async getPublishedPages() {
    return pagesRepo.findPublished();
  }

  async getPageById(id) {
    return pagesRepo.findById(id);
  }

  async getPageBySlug(slug) {
    return pagesRepo.findBySlug(slug);
  }

  async validatePage(data, existing = null) {
    const title = typeof data.title === "string" ? data.title.trim() : "";
    if (!title || title.length > 180)
      throw new Error("Enter a page title of 1–180 characters.");
    const requestedSlug =
      typeof data.slug === "string" ? data.slug.trim() : existing?.slug;
    // The homepage deliberately has an empty slug. Editing its title must not move it.
    const slug =
      existing?.slug === "" && requestedSlug === ""
        ? ""
        : requestedSlug || this.generateSlug(title);
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      throw new Error(
        "Use lowercase letters, numbers, and hyphens in the page address.",
      );
    if (!slug && existing?.slug !== "")
      throw new Error(
        "Enter a page address using lowercase letters or numbers.",
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
      ].includes(slug)
    )
      throw new Error("That address is reserved. Choose another page address.");
    const duplicate = await pagesRepo.findBySlug(slug);
    if (duplicate && duplicate.id !== existing?.id)
      throw new Error(
        "A page already uses that address. Choose a unique address.",
      );
    return {
      title,
      slug,
      content:
        typeof data.content === "string"
          ? data.content
          : existing?.content || "",
      published: data.published === true,
      dataSources: (() => {
        const sources =
          data.dataSourcesPresent && !data.dataSources
            ? []
            : Array.isArray(data.dataSources)
              ? data.dataSources
              : typeof data.dataSources === "string"
                ? data.dataSources
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : existing?.dataSources || [];
        for (const source of sources) {
          if (
            typeof source !== "string" ||
            ["__proto__", "constructor", "prototype"].includes(source)
          )
            throw new Error("Invalid data source.");
          if (
            source.startsWith("view:") &&
            !viewService
              .list()
              .some((v) => v.id === source.slice(5) && v.public)
          )
            throw new Error("Select an existing public data view.");
        }
        return sources;
      })(),
      layout:
        typeof data.layout === "string"
          ? data.layout
          : existing?.layout || null,
      parentSlug:
        typeof data.parentSlug === "string"
          ? data.parentSlug
          : existing?.parentSlug || null,
      styleOverrides:
        typeof data.styleOverrides === "string"
          ? data.styleOverrides
          : existing?.styleOverrides || null,
    };
  }

  async createPage(data) {
    return pagesRepo.create(await this.validatePage(data));
  }

  async updatePage(id, data) {
    const existing = await this.getPageById(id);
    if (!existing) throw new Error("Page not found.");
    return pagesRepo.update(
      id,
      await this.validatePage(
        {
          ...existing,
          ...data,
          ...(data.dataSourcesPresent && !data.dataSources
            ? { dataSources: [] }
            : {}),
        },
        existing,
      ),
    );
  }

  async deletePage(id) {
    return pagesRepo.delete(id);
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
}

export const pagesService = new PagesService();
