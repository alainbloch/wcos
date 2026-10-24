import { normalizeMerits } from "./memberForm.js";
export function normalizeHex(value) {
  if (typeof value !== "string") return "";
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(hex))
    return (
      "#" +
      [...hex.slice(1)]
        .map((c) => c + c)
        .join("")
        .toUpperCase()
    );
  return "";
}
export function isKaiden(member) {
  return normalizeMerits(member.merits).some((merit) =>
    /^(?:(?:head|honorary)\s+)?kaiden(?:\s*\(retired\))?$/i.test(merit),
  );
}
export function kaidenColorOptions(members, excludeId) {
  return members
    .filter(
      (member) =>
        member.id !== excludeId &&
        isKaiden(member) &&
        member.dalmaterColorName?.trim() &&
        normalizeHex(member.dalmaterColorHex),
    )
    .map((member) => ({
      id: member.id,
      name: member.position,
      colorName: member.dalmaterColorName,
      colorHex: normalizeHex(member.dalmaterColorHex),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function prepareDalmater(data, members, id) {
  // Older API callers may edit unrelated fields without submitting this section.
  if (!Object.hasOwn(data, "dalmaterMode")) return data;
  const empty = {
    dalmaterMode: "",
    dalmaterKaidenId: "",
    dalmaterColorName: "",
    dalmaterColorHex: "",
  };
  if (!data.dalmaterMode) return { ...data, ...empty };
  if (data.dalmaterMode === "kaiden") {
    const selected = kaidenColorOptions(members, id).find(
      (member) => member.id === data.dalmaterKaidenId,
    );
    if (!selected)
      throw new Error("Select a Kaiden member with a complete dalmater color");
    // Store a snapshot: deleting or changing the teacher must not erase a student's color.
    return {
      ...data,
      dalmaterKaidenId: selected.id,
      dalmaterColorName: selected.colorName,
      dalmaterColorHex: selected.colorHex,
    };
  }
  if (data.dalmaterMode !== "custom")
    throw new Error("Choose a valid dalmater color option");
  const name =
    typeof data.dalmaterColorName === "string"
      ? data.dalmaterColorName.trim()
      : "";
  const hex = normalizeHex(data.dalmaterColorHex);
  const previous = members.find((member) => member.id === id);
  // Name-only migrated colors may remain unchanged until an administrator knows the shade.
  const unchangedLegacy =
    previous?.dalmaterColorName === name &&
    !previous?.dalmaterColorHex &&
    !data.dalmaterColorHex &&
    previous?.dalmaterLegacyRecords?.length;
  if (!name || (!hex && !unchangedLegacy))
    throw new Error(
      "Enter a color name and a valid hex color (#RRGGBB or #RGB)",
    );
  return {
    ...data,
    dalmaterKaidenId: "",
    dalmaterColorName: name,
    dalmaterColorHex: hex,
  };
}
