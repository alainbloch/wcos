import { readFile } from "node:fs/promises";
import nunjucks from "nunjucks";
import { siteSettingsRepo } from "../models/siteSettingsRepository.js";

export const layoutSections = ["header", "footer", "css"];
// No filesystem loader: saved templates cannot include server files or other layouts.
const templates = new nunjucks.Environment([], { autoescape: true });
export async function layoutDefaults() {
  return {
    header: await readFile(
      new URL("../views/partials/reference-header.njk", import.meta.url),
      "utf8",
    ),
    footer: await readFile(
      new URL("../views/partials/reference-footer.njk", import.meta.url),
      "utf8",
    ),
    css: "",
  };
}
export function layoutContext(settings, page = {}) {
  return {
    siteName: settings.siteName,
    siteEmail: settings.siteEmail,
    currentYear: new Date().getFullYear(),
    page: { title: page.title, slug: page.slug },
  };
}
export function renderLayoutTemplate(content, context) {
  return templates.renderString(content, context);
}
export function validateLayout(section, content, context) {
  if (!layoutSections.includes(section))
    throw new Error("Unknown layout section.");
  if (typeof content !== "string" || content.length > 200000)
    throw new Error("Content must be text, at most 200,000 characters.");
  if (section !== "css") {
    try {
      renderLayoutTemplate(content, context);
    } catch (error) {
      throw new Error(`Template error: ${error.message}`);
    }
  }
  return content;
}
export async function getLayout() {
  const settings = await siteSettingsRepo.getSettings();
  return { ...(await layoutDefaults()), ...settings.referenceLayout };
}
export async function saveLayout(section, content) {
  const settings = await siteSettingsRepo.getSettings();
  validateLayout(section, content, layoutContext(settings));
  await siteSettingsRepo.updateSettings({
    referenceLayout: { ...(await getLayout()), [section]: content },
  });
}
export async function renderLayout(page = {}) {
  const settings = await siteSettingsRepo.getSettings();
  const saved = await getLayout();
  const defaults = await layoutDefaults();
  const context = layoutContext(settings, page);
  const output = {};
  for (const section of ["header", "footer"]) {
    try {
      output[section] = renderLayoutTemplate(saved[section], context);
    } catch {
      output[section] = renderLayoutTemplate(defaults[section], context);
    }
  }
  return output;
}
