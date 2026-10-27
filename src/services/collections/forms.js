/** Compatibility input adapters. Storage, validation and CRUD stay in the generic repository. */
import { readMemberForm, memberFormToRecord } from "../../utils/memberForm.js";
import { readClassForm } from "../classesService.js";
import { readMoveForm } from "../movesService.js";
import { readUpdateForm } from "../updatesService.js";
import { readBinding } from "./render.js";
export function readLegacyForm(collection, body, old) {
  const plain = Object.fromEntries(
    Object.entries(body || {})
      .filter(([key, value]) => !key.startsWith("_") && value?.type !== "file")
      .map(([key, value]) => [
        key,
        value?.type === "field" ? value.value : value,
      ]),
  );
  if (collection === "members")
    return memberFormToRecord(
      readMemberForm(body),
      old?.importedFrom === "hall-of-heroes" && !old.level,
    );
  if (collection === "classes")
    return {
      ...readClassForm(plain),
      ...(plain.clearUnresolved === "on" ? { unresolvedInstructors: [] } : {}),
    };
  if (collection === "moves") {
    const record = readMoveForm(plain);
    if (typeof record.media === "string")
      record.media = JSON.parse(record.media);
    return record;
  }
  if (collection === "updates")
    return readUpdateForm({ ...plain, body: plain.content ?? plain.body });
  if (collection === "pages") {
    return {
      title: plain.title,
      slug: plain.slug ?? old?.slug,
      content: plain.content ?? old?.content ?? "",
      published: plain.published === "on" || plain.published === true,
      dataSources:
        plain.dataSourcesPresent && !plain.dataSources
          ? []
          : Array.isArray(plain.dataSources)
            ? plain.dataSources
            : typeof plain.dataSources === "string"
              ? plain.dataSources.split(",").filter(Boolean)
              : old?.dataSources || [],
      dataView: readBinding(plain, old?.dataView),
      layout: plain.layout ?? old?.layout ?? null,
      parentSlug: plain.parentSlug ?? old?.parentSlug ?? null,
      styleOverrides: plain.styleOverrides ?? old?.styleOverrides ?? null,
    };
  }
  return plain;
}
export function readGeneratedForm(definition, body) {
  const values = {};
  for (const field of definition.fields) {
    const value = body[field.name];
    if (field.type === "boolean")
      values[field.name] = value === true || value === "on";
    else if (value !== undefined && value !== "") {
      if (field.type === "number") values[field.name] = Number(value);
      else if (
        field.type === "relationship" &&
        !["one-to-one", "many-to-one"].includes(field.cardinality)
      )
        values[field.name] = Array.isArray(value) ? value : [value];
      else if (["array", "object"].includes(field.type))
        values[field.name] =
          typeof value === "string" ? JSON.parse(value) : value;
      else values[field.name] = value;
    }
  }
  return values;
}
