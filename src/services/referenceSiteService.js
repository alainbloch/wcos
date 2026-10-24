/** Public source content and CMS overrides share one page model. */
import fs from "node:fs";
import sanitizeHtml from "sanitize-html";
import { pagesRepo, getDatabase } from "../models/database.js";

export const originalPages = JSON.parse(
  fs.readFileSync(new URL("../content/original-pages.json", import.meta.url)),
);
const bySlug = new Map(originalPages.map((page) => [page.slug, page]));

export function sanitizePageContent(content) {
  return sanitizeHtml(content || "", {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "details",
      "summary",
      "button",
      "form",
      "input",
      "select",
      "option",
      "textarea",
      "label",
      "svg",
      "path",
      "circle",
      "rect",
      "line",
      "polyline",
      "polygon",
      "g",
      "use",
      "dialog",
    ]),
    allowedAttributes: {
      "*": [
        "class",
        "id",
        "style",
        "title",
        "role",
        "aria-*",
        "data-*",
        "tabindex",
        "hidden",
      ],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading", "decoding"],
      form: ["action", "method"],
      input: [
        "type",
        "name",
        "value",
        "required",
        "maxlength",
        "placeholder",
        "autocomplete",
        "checked",
      ],
      select: ["name", "required"],
      option: ["value", "selected"],
      textarea: ["name", "rows", "required", "maxlength", "placeholder"],
      label: ["for"],
      button: ["type", "name", "value", "disabled"],
      details: ["open"],
      svg: ["viewBox", "width", "height", "fill", "xmlns"],
      path: ["d", "fill"],
      use: ["href"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    // Layout is trusted imported CSS. CMS content may not load arbitrary CSS URLs.
    allowedStyles: {
      "*": {
        color: [/^#[\da-f]{3,8}$/i],
        "text-align": [/^(left|right|center|justify)$/],
        "background-image": [/^url\(['"]?\/images\/[\w.%-]+['"]?\)$/],
      },
    },
    transformTags: {
      a: (tag, attrs) => ({
        tagName: tag,
        attribs: {
          ...attrs,
          ...(attrs.target === "_blank" ? { rel: "noopener noreferrer" } : {}),
        },
      }),
    },
  });
}

/** Seed missing pages only; restarting must never overwrite an editor's changes. */
export async function ensureReferencePages() {
  const db = getDatabase();
  if (db.data.referenceMigrationVersion === 1) return;
  const existing = new Set(db.data.pages.map((p) => p.slug));
  db.data.pages.push(
    ...originalPages
      .filter((p) => !existing.has(p.slug))
      .map((p) => ({ ...p, migrated: true })),
  );
  db.data.referenceMigrationVersion = 1;
  await db.write();
}

export async function getPublicPage(slug) {
  const stored = await pagesRepo.findBySlug(slug);
  if (!stored || !stored.published) return null;
  const source = bySlug.get(slug);
  return {
    ...source,
    ...stored,
    styles: source?.styles || originalPages.find((p) => p.slug === "").styles,
    bodyClass: source?.bodyClass || "elementor-kit-12",
    // Original pages are reviewed, immutable build artifacts. Editor changes pass
    // through the sanitizer so script execution cannot be introduced in the CMS.
    content:
      stored.content === source?.content
        ? stored.content
        : sanitizePageContent(stored.content),
  };
}

export async function searchPages(query) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const pages = await pagesRepo.findPublished();
  return pages
    .flatMap((page) => {
      const text = sanitizeHtml(page.content || "", {
        allowedTags: [],
        allowedAttributes: {},
      })
        .replace(/\s+/g, " ")
        .trim();
      const searchable = `${page.title} ${text}`.toLocaleLowerCase();
      if (!terms.every((term) => searchable.includes(term))) return [];
      const index = Math.max(
        0,
        text.toLocaleLowerCase().indexOf(terms[0]) - 60,
      );
      return [
        {
          title: page.title,
          url: `/${page.slug}`,
          excerpt: text.slice(index, index + 230),
        },
      ];
    })
    .slice(0, 50);
}
