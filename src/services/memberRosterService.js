import { load } from "cheerio";

export const memberRosterService = {
  replaceRows(content, rows) {
    // Replace only the roster rows: CMS edits to headings, introductory content,
    // surrounding layout, and the original column widths remain authoritative.
    const $ = load(content, null, false);
    const header = $("#list-header");
    if (!header.length) return content;
    const roster = header.parent();
    const portraits = new Map();
    roster
      .children(".table-row")
      .not(header)
      .each((_, row) => {
        const columns = $(row).children();
        const name = columns.eq(2).text().trim();
        const image = $(row).find("img").attr("src");
        if (name && image) portraits.set(name, image);
      });
    roster.children(".table-row, .member-empty").not(header).remove();
    header.after(rows);
    // Records imported before image editing existed can reuse their captured portrait.
    roster.find("[data-member-portrait]").each((_, image) => {
      const portrait = portraits.get($(image).attr("data-member-portrait"));
      if (!$(image).attr("src") && portrait) $(image).attr("src", portrait);
      if (!$(image).attr("src")) $(image).remove();
    });
    return $.html();
  },
};
