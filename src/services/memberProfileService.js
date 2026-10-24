import fs from "node:fs";
import { load } from "cheerio";
import MarkdownIt from "markdown-it";
import { originalPages, sanitizePageContent } from "./referenceSiteService.js";

const markdown = new MarkdownIt({ html: false, linkify: false });
const sourcePage = originalPages.find(
  (page) => page.slug === "member-profiles",
);
const source = load(sourcePage.content);
const capturedMembers = source(".table-row")
  .not("#list-header")
  .map((_, row) => {
    const columns = source(row).children();
    const ranks = columns
      .eq(0)
      .find("p")
      .map((_, cell) => source(cell).text().trim())
      .get();
    return {
      position: columns.eq(2).text().trim(),
      level: ranks[0],
      steelRank: ranks[1],
      image: columns.eq(1).find("img").attr("src") || "",
      merits: columns
        .eq(3)
        .find("p")
        .map((_, cell) => source(cell).text().trim())
        .get(),
      memberSince: columns.eq(4).text().trim(),
      region: columns.eq(5).text().trim(),
    };
  })
  .get();
// Gad is the complete historical profile captured during migration. Preserve its
// real biography/statistics; never invent missing biographies for other members.
const gad = load(
  fs.readFileSync(
    new URL("../views/partials/member-dialog.njk", import.meta.url),
    "utf8",
  ),
);
const historicalStats = new Map();
gad("table tr").each((_, row) => {
  const cells = gad(row).children("td");
  if (cells.length === 2)
    historicalStats.set(cells.eq(0).text().trim(), cells.eq(1).text().trim());
});
const historicalBiography = sanitizePageContent(
  gad(".elementor-widget-text-editor").last().html(),
);
const fields = [
  ["yearsFought", "Years Fought"],
  ["battlesFought", "Battles Fought"],
  ["steelBattlesFought", "Steel Battles Fought"],
  ["opponentsFought", "Opponents Fought"],
  ["weaponType", "Weapon Type"],
];

export const memberProfileService = {
  capturedMembers,
  profiles(members) {
    return members.map((member, index) => {
      const captured = capturedMembers.find(
        (item) => item.position === member.position,
      );
      const isGad = member.position === "Gad";
      const profile = {
        ...captured,
        ...member,
        dialogId:
          isGad &&
          members.findIndex((item) => item.position === "Gad") === index
            ? "member-gad"
            : `member-profile-${index}`,
      };
      profile.image =
        member.image || (isGad ? "/images/gad.jpg" : captured?.image) || "";
      profile.thumbnail = member.image || captured?.image || "";
      profile.email = member.email || (isGad ? "gad@westerncircle.org" : "");
      // Only a plain email address may become a mailto link.
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(profile.email))
        profile.email = "";
      profile.biographyHtml = member.biography
        ? sanitizePageContent(markdown.render(member.biography))
        : isGad
          ? historicalBiography
          : "";
      profile.stats = fields
        .map(([key, label]) => ({
          label,
          value: member[key] || (isGad ? historicalStats.get(label) : ""),
        }))
        .filter((stat) => stat.value);
      profile.stats.splice(
        3,
        0,
        {
          label: "WCoS Ranking",
          value: member.level || captured?.level || "—",
        },
        {
          label: "Steel Ranking",
          value:
            member.steelRank ||
            (isGad
              ? historicalStats.get("Steel Ranking")
              : captured?.steelRank) ||
            "—",
        },
      );
      profile.statsUpdated =
        member.statsUpdated || (isGad ? "3/1/15 (historical profile)" : "");
      return profile;
    });
  },
};
