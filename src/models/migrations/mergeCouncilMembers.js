import { randomUUID } from "node:crypto";
const text = (value) => (typeof value === "string" ? value.trim() : "");
const key = (value) => text(value).toLowerCase().replace(/\s+/g, " ");
const truth = (value) => value === true || value === "on" || value === "true";
// Exact aliases for the old bundled seed records, not fuzzy matching of real people.
const seedNames = {
  "kaiden steel wind": "steel wind",
  "kaiden ravenstar": "vea ravenstar",
  "kaiden severer": "the severer",
};

export function mergeCouncilMembers(data) {
  if (!Object.hasOwn(data, "councilMembers")) return false;
  if (!Array.isArray(data.councilMembers))
    throw new Error("Legacy councilMembers must be an array");
  data.members ||= [];
  for (const council of data.councilMembers) {
    // These were dated headings, not people. The migration backup retains them.
    if (key(council.name) === "council formation") continue;
    const name = text(council.name);
    if (!name) continue; // Unnamed records remain recoverable in the backup.
    const exact = data.members.filter(
      (member) => key(member.position) === key(name),
    );
    const matches = exact.length
      ? exact
      : data.members.filter(
          (member) => key(member.position) === seedNames[key(name)],
        );
    let member = matches.length === 1 ? matches[0] : null;
    if (!member) {
      member = {
        id: `members_${randomUUID()}`,
        position: name,
        level: "",
        steelRank: "",
        circleName: "",
        merits: [],
        active: false,
      };
      data.members.push(member);
    }
    const term = {
      councilPosition: text(council.position),
      councilTitle: text(council.title),
      councilTermStart: text(council.termStart),
      councilTermEnd: text(council.termEnd),
      councilHistoricalDate: text(council.historicalDate),
      councilCurrent: truth(council.current),
    };
    // Preserve every original term (and its source ID) when one person has several.
    member.councilHistory ||= [];
    member.councilHistory.push({ ...term, legacyId: council.id || null });
    if (member.councilHistory.length === 1 || term.councilCurrent) {
      for (const [field, value] of Object.entries(term)) {
        if (
          member[field] === undefined ||
          (term.councilCurrent && !member.councilCurrent)
        )
          member[field] = value;
      }
    }
    if (!member.biography)
      member.biography = text(council.bio) || text(council.description);
    if (!member.image) member.image = text(council.image);
  }
  delete data.councilMembers;
  return true;
}
