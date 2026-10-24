/**
 * Convert browser-exported DOM/CSS into portable CMS content. Run only against
 * reviewed public-page captures; no WordPress scripts or server endpoints survive.
 * Usage: node scripts/import-site-reference.mjs /absolute/capture/directory
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { load } from "cheerio";

const input = process.argv[2];
if (!input)
  throw new Error("Pass the directory containing the reviewed page captures.");
const captures = fs
  .readdirSync(input)
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({
    slug: name.replace(".json", ""),
    data: JSON.parse(fs.readFileSync(path.join(input, name))),
  }))
  .filter(({ data }) => data.html && data.title && data.url);
const pagePaths = new Set(
  captures.map(({ slug }) => `/${slug === "home" ? "" : slug}`),
);
const assets = new Set(fs.readdirSync("public/images"));
const missing = new Set();

function localUrl(value) {
  if (!value || value.startsWith("data:") || value.startsWith("#"))
    return value;
  let url;
  try {
    url = new URL(value, "https://vead.sg-host.com");
  } catch {
    return value;
  }
  if (url.hostname !== "vead.sg-host.com") return value;
  if (url.pathname.endsWith("/letter-x.svg")) return "/images/letter-x.svg";
  if (url.pathname.startsWith("/wp-content/uploads/")) {
    const name = decodeURIComponent(path.basename(url.pathname));
    const fullSize = name.replace(/-\d+x\d+(?=\.)/, "");
    if (assets.has(name)) return `/images/${name}`;
    if (assets.has(fullSize)) return `/images/${fullSize}`;
    missing.add(value);
    return value;
  }
  const cleanPath = url.pathname.replace(/\/$/, "") || "/";
  if (pagePaths.has(cleanPath)) return cleanPath + url.search + url.hash;
  if (
    url.pathname === "/category/events/" ||
    url.pathname === "/category/ranking/"
  )
    return "/news";
  return value;
}

function rewriteUrls(text) {
  return text.replace(
    /https?:\/\/vead\.sg-host\.com\/[^\s"'<>\\)]+/g,
    localUrl,
  );
}

function convertMarkup(markup) {
  const $ = load(markup, null, false);
  $(
    "script, noscript, style, .swiper-slide-duplicate, .swiper-notification",
  ).remove();
  $("*").each((_, element) => {
    const el = $(element);
    for (const key of Object.keys(element.attribs || {})) {
      if (
        /^on/i.test(key) ||
        key === "srcset" ||
        key === "sizes" ||
        key === "data-settings" ||
        key === "data-e-action-hash"
      )
        el.removeAttr(key);
    }
    el.removeClass("elementor-invisible");
    for (const attr of ["src", "href", "poster"])
      if (el.attr(attr)) el.attr(attr, localUrl(el.attr(attr)));
    if (el.attr("style")) el.attr("style", rewriteUrls(el.attr("style")));
    if (el.attr("href")?.startsWith("javascript:")) el.removeAttr("href");
  });
  // Native disclosure widgets retain every original accordion's content and work
  // without JavaScript, including keyboard and assistive-technology support.
  $(".jkit-accordion .card-wrapper").each((_, element) => {
    const el = $(element),
      title = el.find(".card-header .title").first().html();
    const content = el.find(".card-body").first().html();
    const heading = el.find(".card-header-button").first().html();
    el.replaceWith(
      `<details class="reference-accordion card-wrapper"><summary class="card-header"><span class="card-header-button">${heading || title || ""}</span></summary><div class="card-expand"><div class="card-body">${content || ""}</div></div></details>`,
    );
  });
  $(".e-n-accordion-item").each((_, element) => $(element).removeAttr("open"));
  $(".swiper-wrapper, .swiper-slide").removeAttr("style");
  $(".swiper-pagination, .elementor-swiper-button").remove();
  $(".swiper")
    .attr("tabindex", "0")
    .attr("aria-label", "Image gallery; scroll to see more images");
  // A captured search plugin has no backend here. Use the local full-text search.
  $(".asl_w_container").each((_, element) =>
    $(element).replaceWith(
      '<form class="reference-search" action="/search" role="search"><label class="sr-only" for="site-search">Search this site</label><input id="site-search" name="q" type="search" placeholder="Search here.." maxlength="200"><button aria-label="Search" type="submit">⌕</button></form>',
    ),
  );
  $('[id^="ajaxsearchlite"], .asl_s, .asl_r, .asl_hidden_data').remove();
  $(".reference-search").each((index, form) => {
    const id = `site-search-${index}`;
    $(form).find("input").attr("id", id);
    $(form).find("label").attr("for", id);
  });
  // Browser exports omit hidden input values. Restore the public hosted-button
  // configuration verified against the repository's WordPress export.
  const paypalFields = {
    cmd: "_s-xclick",
    hosted_button_id: "CK23BQFMGKR3Y",
    on0: "Dues Choices",
    on1: "Current Rank",
    on2: "Primary Dojo",
    on3: "Other Notes (optional)",
    currency_code: "USD",
  };
  $(
    'form[action="https://www.paypal.com/cgi-bin/webscr"] input[type="hidden"]',
  ).each((_, field) => {
    const value = paypalFields[$(field).attr("name")];
    if (value) $(field).attr("value", value);
  });
  // Replace inline popup links with the migrated native dialog target.
  $('a[href*="popup%3Aopen"]')
    .attr("href", "#member-gad")
    .attr("data-member-dialog", "member-gad");
  $('a[href*="wp-admin"]').attr("href", "/news");
  $('a[target="_blank"]').attr("rel", "noopener noreferrer");
  // Empty social links in the source are not real destinations.
  $(".elementor-social-icon").each((_, el) => {
    if (!$(el).attr("href")) {
      $(el).replaceWith(
        $("<span>")
          .attr("class", $(el).attr("class"))
          .attr("aria-hidden", "true")
          .html($(el).html()),
      );
    }
  });
  $("form.elementor-form").each((_, element) => {
    const form = $(element);
    form
      .attr("action", "/contact")
      .attr("method", "post")
      .attr("data-contact-form", "");
    form.find('input[type="hidden"]').remove();
    const names = {
      name: "name",
      email: "email",
      field_653bcd5: "phone",
      message: "message",
      field_6e99150: "training",
    };
    form.find("[name]").each((_, field) => {
      const name = $(field)
        .attr("name")
        .match(/^form_fields\[(.+)\]$/)?.[1];
      if (names[name])
        $(field)
          .attr("name", names[name])
          .attr("maxlength", name === "message" ? "10000" : "200");
    });
    form.append(
      '<p class="contact-status" role="status" aria-live="polite"></p><p>You can also email <a href="mailto:westerncouncil@gmail.com">westerncouncil@gmail.com</a>.</p><div class="contact-trap" aria-hidden="true"><label>Leave blank<input name="website" tabindex="-1" autocomplete="off"></label></div>',
    );
  });
  return $.html();
}

const pages = [];
for (const { slug, data } of captures) {
  if (data.html.includes("[Truncated]"))
    throw new Error(`Incomplete DOM capture: ${slug}`);
  const $ = load(data.html);
  const content = $(
    '[data-elementor-type="wp-page"], [data-elementor-type="single-post"]',
  ).first();
  if (!content.length) throw new Error(`Missing page body: ${slug}`);
  const styles = [];
  for (const sheet of data.styles) {
    if (!sheet.css || /fonts\.googleapis/.test(sheet.href || "")) continue;
    if (sheet.css.includes("[Truncated]"))
      throw new Error(`Incomplete CSS: ${slug}, ${sheet.href}`);
    let css = sheet.css
      .replace(/url\(["']?([^"')]+)["']?\)/g, (match, url) => {
        if (url.startsWith("data:") || url.startsWith("#")) return match;
        const resolved = new URL(url, sheet.href || data.url);
        if (/\.(woff2?|ttf|eot)(\?|$)/.test(resolved.href)) {
          const file = path
            .basename(resolved.pathname)
            .replace(/\.(woff|ttf|eot)$/, ".woff2");
          return `url("/fonts/${file}")`;
        }
        return `url("${localUrl(resolved.href)}")`;
      })
      .replace(
        /format\("(?:truetype|woff|embedded-opentype)"\)/g,
        'format("woff2")',
      );
    const hash = crypto
      .createHash("sha256")
      .update(css)
      .digest("hex")
      .slice(0, 16);
    const file = `/css/original/${hash}.css`;
    fs.writeFileSync(`public${file}`, css);
    styles.push(file);
  }
  pages.push({
    id: `source-${content.attr("data-elementor-id")}-${slug}`,
    slug: slug === "home" ? "" : slug,
    title: $("h1").first().text().trim() || data.title.split("|")[0].trim(),
    seoTitle: data.title,
    description: $('meta[name="description"]').attr("content") || "",
    bodyClass: $("body").attr("class") || "elementor-kit-12",
    styles,
    content: convertMarkup($.html(content)),
    published: true,
    sourceUrl: data.url,
  });
  if (slug === "home") {
    fs.writeFileSync(
      "src/views/partials/reference-header.njk",
      convertMarkup($.html($('[data-elementor-type="header"]').first())),
    );
    fs.writeFileSync(
      "src/views/partials/reference-footer.njk",
      convertMarkup($.html($('[data-elementor-type="footer"]').first())),
    );
  }
}
fs.writeFileSync(
  "src/content/original-pages.json",
  JSON.stringify(pages, null, 2) + "\n",
);
fs.writeFileSync(
  "src/content/asset-report.json",
  JSON.stringify({ pages: pages.length, missing: [...missing] }, null, 2) +
    "\n",
);
console.log(
  `Converted ${pages.length} pages; ${missing.size} asset references need review.`,
);

// Remove superseded generated styles after all page references have been saved.
const usedStyles = new Set(
  pages.flatMap((page) => page.styles.map((file) => path.basename(file))),
);
for (const file of fs.readdirSync("public/css/original")) {
  if (file.endsWith(".css") && !usedStyles.has(file))
    fs.unlinkSync(`public/css/original/${file}`);
}
