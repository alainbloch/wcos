import { load } from "cheerio";

export const memberRosterService = {
  attachProfileLinks(content, profiles) {
    const $ = load(content, null, false);
    $(".table-row")
      .not("#list-header")
      .each((_, row) => {
        const name = $(row).children().eq(2).find("p").first().text().trim();
        const memberId = $(row).attr("data-member-id");
        const profile = profiles.find((item) =>
          memberId ? item.id === memberId : item.position === name,
        );
        if (!profile) return;
        // The entire row is a keyboard-operable trigger, not just one special name.
        $(row).attr({
          "data-member-dialog": profile.dialogId,
          tabindex: "0",
          role: "button",
          "aria-haspopup": "dialog",
          "aria-controls": profile.dialogId,
          "aria-label": `View ${profile.position}'s profile`,
        });
        if (row.tagName === "a") $(row).attr("href", `#${profile.dialogId}`);
      });
    return $.html();
  },
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
