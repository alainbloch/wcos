// Multipart fields contain a circular `fields` reference. Only extract text values;
// never copy request objects into records or view models.
function textValue(value) {
  if (value?.type === "field") value = value.value;
  return typeof value === "string" ? value : "";
}

export function normalizeMerits(value) {
  if (value?.type === "field") value = value.value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) value = parsed;
    } catch {
      /* Plain textarea content is newline-separated. */
    }
  }
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .flatMap((entry) => textValue(entry).split(/\r?\n/))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const textFields = [
  "circleName",
  "level",
  "steelRank",
  "position",
  "memberSince",
  "region",
  "biography",
  "image",
  "email",
  "yearsFought",
  "battlesFought",
  "steelBattlesFought",
  "opponentsFought",
  "weaponType",
  "statsUpdated",
];

export function readMemberForm(body = {}) {
  const form = Object.fromEntries(
    textFields.map((key) => [key, textValue(body?.[key])]),
  );
  form.merits = normalizeMerits(body?.merits);
  form.active = body?.active === true || textValue(body?.active) === "on";
  return form;
}

export function memberFormToRecord(form) {
  if (!form.circleName.trim()) throw new Error("Circle name is required");
  if (!/^L[1-7]$/.test(form.level)) throw new Error("Select a valid level");
  const steelRank = form.steelRank || form.level;
  if (!/^L[1-7]$/.test(steelRank)) throw new Error("Select a valid steel rank");
  const { position, ...fields } = form;
  return {
    ...fields,
    steelRank,
    // The imported schema stores the fighter name in position and rank in circleName.
    position: form.circleName.trim(),
    circleName:
      form.level === steelRank
        ? form.level
        : `${form.level} - ${steelRank.toLowerCase()}`,
    merits: [...new Set([position.trim(), ...form.merits].filter(Boolean))],
  };
}

export function memberRecordToForm(member) {
  const merits = normalizeMerits(member.merits);
  return {
    ...readMemberForm(member),
    id: member.id,
    circleName: textValue(member.position),
    position: merits[0] || "",
    merits,
  };
}
