import { randomUUID } from "node:crypto";
import { normalizeHex, isKaiden } from "../../utils/memberDalmater.js";
import { normalizeMerits } from "../../utils/memberForm.js";
const text = (value) => (typeof value === "string" ? value.trim() : "");
const nameKey = (value) =>
  text(value)
    .toLowerCase()
    .replace(/^(?:(?:head|honorary)\s+)?kaiden\s+/, "")
    .replace(/\s*\(retired\)$/, "")
    .replace(/\s+/g, " ")
    .trim();

export function mergeDalmaterColors(data) {
  if (!Object.hasOwn(data, "dalmaterColors")) return false;
  if (!Array.isArray(data.dalmaterColors))
    throw new Error("Legacy dalmaterColors must be an array");
  data.members ||= [];
  for (const legacy of data.dalmaterColors) {
    const name = text(legacy.kaiden);
    // Red Dalmater is a qualification, not a person. Keep rules in the backup
    // and the existing public page rather than fabricating a member profile.
    if (
      !name ||
      legacy.isRedDalmater === true ||
      legacy.isRedDalmater === "on" ||
      nameKey(name) === "red dalmater"
    )
      continue;
    const target = nameKey(name) === "severer" ? "the severer" : nameKey(name);
    const matches = data.members.filter(
      (member) => nameKey(member.position) === target,
    );
    let member = matches.length === 1 ? matches[0] : null;
    if (!member) {
      member = {
        id: `members_${randomUUID()}`,
        position: name
          .replace(/^(?:(?:Head|Honorary)\s+)?Kaiden\s+/i, "")
          .replace(/\s*\(retired\)$/i, "")
          .trim(),
        level: "",
        merits: [],
        active: false,
      };
      data.members.push(member);
    }
    if (!isKaiden(member))
      member.merits = [...normalizeMerits(member.merits), "Kaiden"];
    member.dalmaterLegacyRecords ||= [];
    member.dalmaterLegacyRecords.push(structuredClone(legacy));
    if (member.dalmaterColorName || member.dalmaterColorHex) continue;
    const hex = normalizeHex(legacy.colorHex) || normalizeHex(legacy.color);
    const colorName =
      text(legacy.colorName) ||
      (!normalizeHex(legacy.color) ? text(legacy.color) : "") ||
      hex;
    member.dalmaterMode = colorName ? "custom" : "";
    member.dalmaterKaidenId = "";
    member.dalmaterColorName = colorName;
    member.dalmaterColorHex = hex;
  }
  delete data.dalmaterColors;
  return true;
}
