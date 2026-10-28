import { prepareRecord, validateDeletion, afterWrite } from "./rules.js";
import { validateViews } from "./views.js";
import { randomUUID, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { getDatabase } from "../../models/database.js";
import config from "../../config/index.js";
import {
  assertSafe,
  normalizeDefinition,
  systemDefinitions,
  SYSTEM,
  LOCKED,
  builtins,
  validateRecord,
  SYSTEM_FIELDS,
  jsonSchema,
  fieldsFromSchema,
} from "./schema.js";

export const emptyState = () => ({
  definitions: [],
  records: {},
  views: [],
  history: [],
});
export const stateOf = (data) => data.dynamic || emptyState();
export const definitionsOf = (data) => {
  const initial = systemDefinitions(data);
  const saved = stateOf(data).definitions.map((definition) => {
    // Older backups predate schema annotations. Fill missing metadata from the
    // initial schema, keeping every explicitly saved field choice and constraint.
    const source = initial.find((d) => d.id === definition.id);
    if (definition.jsonSchema?.["x-wcos"]) {
      const annotations = definition.jsonSchema["x-wcos"];
      return {
        ...definition,
        capabilities: annotations.capabilities ?? source?.capabilities ?? {},
        contentField:
          annotations.contentField ?? source?.contentField ?? "content",
        fields: fieldsFromSchema(definition.jsonSchema),
      };
    }
    const fields = definition.fields.map((field) => ({
      ...source?.fields.find(
        (f) => f.name === field.name && f.type === field.type,
      ),
      ...field,
    }));
    const upgraded = { ...source, ...definition, fields };
    upgraded.jsonSchema = jsonSchema(upgraded);
    return { ...upgraded, fields: fieldsFromSchema(upgraded.jsonSchema) };
  });
  return [
    ...initial.filter((d) => !saved.some((s) => s.id === d.id)),
    ...saved,
  ];
};

function setRows(data, id, rows) {
  if (SYSTEM.includes(id)) data[id] = rows;
  else data.dynamic.records[id] = rows;
}
export const rowsOf = (data, collection) =>
  SYSTEM.includes(collection)
    ? data[collection] || []
    : stateOf(data).records[collection] || [];
export const revisionOf = (data) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex");
export function validateState(data) {
  const state = stateOf(data);
  assertSafe(state);
  if (
    !Array.isArray(state.definitions) ||
    !Array.isArray(state.views) ||
    !state.records ||
    typeof state.records !== "object" ||
    Array.isArray(state.records) ||
    !Array.isArray(state.history)
  )
    throw new Error("Invalid dynamic database state.");
  const definitions = state.definitions.map(normalizeDefinition);
  definitions.forEach((definition, index) => {
    for (const field of definition.fields) {
      const original = state.definitions[index].fields.find(
        (f) => f.name === field.name,
      );
      if (field.type === "richtext" && original.default !== field.default)
        throw new Error("Unsafe rich-text default.");
    }
  });
  if (new Set(definitions.map((d) => d.id)).size !== definitions.length)
    throw new Error("Duplicate collection identifier.");
  if (
    Object.keys(state.records).some(
      (id) => !definitions.some((d) => d.id === id),
    )
  )
    throw new Error("Records have no schema.");
  const all = definitionsOf(data);
  for (const def of definitions) {
    const rows = rowsOf(data, def.id);
    if (!Array.isArray(rows) || rows.length > 50000)
      throw new Error("Invalid record collection.");
    const ids = new Set();
    for (const row of rows) {
      if (!row.id || typeof row.id !== "string" || ids.has(row.id))
        throw new Error("Invalid or duplicate record ID.");
      ids.add(row.id);
      const clean = validateRecord(def, row);
      // Imports must not bypass sanitization; reject unsafe rich text rather than silently changing a backup.
      for (const f of def.fields)
        if (
          builtins[def.id]?.[f.name] !== "richtext" &&
          f.type === "richtext" &&
          clean[f.name] !== row[f.name]
        )
          throw new Error(`Unsafe rich text in ${def.id}.${f.name}`);
    }
    for (const f of def.fields) {
      if (f.type === "relationship" && !all.some((d) => d.id === f.target))
        throw new Error(`Missing relationship collection: ${f.target}`);
      const seen = new Set();
      const targetIds = new Set(rowsOf(data, f.target).map((row) => row.id));
      for (const row of rows) {
        const value = row[f.name];
        if (
          value === undefined ||
          (!f.required && (value === null || value === ""))
        )
          continue;
        if (f.unique) {
          const key = JSON.stringify(value);
          if (seen.has(key)) throw new Error(`${f.label} must be unique.`);
          seen.add(key);
        }
        if (f.type === "relationship")
          for (const id of Array.isArray(value) ? value : [value]) {
            if (!targetIds.has(id))
              throw new Error(`${f.label}: referenced record does not exist.`);
          }
      }
      if (
        f.type === "relationship" &&
        ["one-to-one", "one-to-many"].includes(f.cardinality)
      ) {
        const owners = new Set();
        for (const row of rows)
          for (const id of [row[f.name]].flat().filter(Boolean)) {
            if (owners.has(id))
              throw new Error(
                `${f.label}: target already belongs to another record.`,
              );
            owners.add(id);
          }
      }
    }
  }
  validateViews(data);
  for (const page of data.pages || []) {
    const ids = Array.isArray(page.dataSources)
      ? page.dataSources
          .filter((s) => typeof s === "string" && s.startsWith("view:"))
          .map((s) => s.slice(5))
      : [];
    for (const id of ids)
      if (!state.views.some((v) => v.id === id && v.public))
        throw new Error("Page references a missing or private data view.");
  }
  return true;
}
export function assertNotReferenced(data, collection, id) {
  for (const def of definitionsOf(data))
    for (const f of def.fields) {
      if (f.type !== "relationship" || f.target !== collection) continue;
      if (rowsOf(data, def.id).some((row) => [row[f.name]].flat().includes(id)))
        throw new Error(
          `Record is referenced by ${def.label}.${f.label}. Remove the relationship first.`,
        );
    }
}
// Adapter boundary: mutations work on an isolated candidate and publish only after a successful write.
export class LowCollectionAdapter {
  read() {
    return getDatabase().data;
  }
  async commit(candidate) {
    const db = getDatabase(),
      previous = db.data;
    db.data = candidate;
    try {
      await db.write();
    } catch (error) {
      db.data = previous;
      throw error;
    }
  }
}
const COMPARED_KEYS = [
  "type",
  "label",
  "required",
  "unique",
  "min",
  "max",
  "pattern",
  "options",
  "target",
  "cardinality",
  "control",
  "nullable",
  "default",
  "optionRule",
  "group",
];
// Human- and machine-readable description of a schema edit, used to annotate
// the automatic backup with exactly what was removed or changed.
export function schemaChanges(previous, definition, data) {
  const next = new Map(definition.fields.map((f) => [f.name, f]));
  const removed = [];
  for (const f of previous?.fields || []) {
    if (next.has(f.name)) continue;
    const records = rowsOf(data, definition.id).filter((row) =>
      Object.hasOwn(row, f.name),
    ).length;
    removed.push({ name: f.name, label: f.label, type: f.type, records });
  }
  const before = new Map((previous?.fields || []).map((f) => [f.name, f]));
  const added = [];
  const changed = [];
  for (const f of definition.fields) {
    const old = before.get(f.name);
    if (!old) {
      added.push({ name: f.name, label: f.label, type: f.type });
      continue;
    }
    const changes = {};
    for (const key of COMPARED_KEYS)
      if (JSON.stringify(old[key]) !== JSON.stringify(f[key]))
        changes[key] = { from: old[key] ?? null, to: f[key] ?? null };
    if (Object.keys(changes).length)
      changed.push({ name: f.name, changes });
  }
  const summary = [
    ...removed.map((f) =>
      `removed ${f.name} (${f.records} record${f.records === 1 ? "" : "s"})`,
    ),
    ...added.map((f) => `added ${f.name} (${f.type})`),
    ...changed.map((f) => `changed ${f.name} (${Object.keys(f.changes).join(", ")})`),
  ].join("; ");
  return {
    summary: summary || "no schema changes recorded",
    removed,
    added,
    changed,
  };
}
// Schema edits that remove populated fields migrate record values away. A
// complete database snapshot is written beside DB_PATH first so the change is
// always reversible (same naming convention as explicit content migrations);
// a sidecar .changes.json describes exactly what the edit changed.
export async function writeSchemaBackup(collection, data, changes) {
  const backup = `${config.dbPath}.backup-schema-${collection}-${Date.now()}`;
  await writeFile(backup, JSON.stringify(data, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  if (changes) {
    const meta = {
      backup,
      collection,
      savedAt: new Date().toISOString(),
      summary: changes.summary,
      removed: changes.removed,
      added: changes.added,
      changed: changes.changed,
    };
    await writeFile(`${backup}.changes.json`, JSON.stringify(meta, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
  }
  return backup;
}
export class CollectionStore {
  constructor(adapter = new LowCollectionAdapter(), backup = writeSchemaBackup) {
    this.adapter = adapter;
    this.backup = backup;
    this.queue = Promise.resolve();
  }
  data() {
    return this.adapter.read();
  }
  definitions() {
    return definitionsOf(this.data());
  }
  definition(id) {
    const def = this.definitions().find((d) => d.id === id);
    if (!def) throw new Error("Collection not found.");
    return def;
  }
  rows(id) {
    this.definition(id);
    return structuredClone(rowsOf(this.data(), id));
  }
  async mutate(change) {
    const run = this.queue.then(async () => {
      const candidate = structuredClone(this.data());
      candidate.dynamic ||= emptyState();
      const result = await change(candidate);
      validateState(candidate);
      await this.adapter.commit(candidate);
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
  preview(input) {
    const existingDefinition = definitionsOf(this.data()).find(definition => definition.id === input.id);
    if (
      (!existingDefinition || existingDefinition.orderField === "sortOrder") &&
      input.orderField === undefined &&
      Array.isArray(input.fields) &&
      !input.fields.some((field) => field.name === "sortOrder")
    ) {
      input = {
        ...input,
        orderField: "sortOrder",
        fields: [
          ...input.fields,
          {
            name: "sortOrder",
            label: "Order",
            type: "number",
            min: 0,
            control: "hidden",
          },
        ],
      };
    }
    const definition = normalizeDefinition(input),
      data = this.data(),
      candidate = structuredClone(data);
    candidate.dynamic ||= emptyState();
    const previous = definitionsOf(data).find((d) => d.id === definition.id);
    const errors = [];
    const warnings = [];
    const removed = new Set(
      (previous?.fields || [])
        .filter((f) => !definition.fields.some((n) => n.name === f.name))
        .map((f) => f.name),
    );
    if (removed.size)
      for (const name of removed) {
        const affected = rowsOf(data, definition.id).filter((row) =>
          Object.hasOwn(row, name),
        ).length;
        if (affected)
          warnings.push(
            `Field ${name} will be removed from ${affected} record${affected === 1 ? "" : "s"}. A backup is created automatically before applying.`,
          );
      }
    candidate.dynamic.definitions = candidate.dynamic.definitions
      .filter((d) => d.id !== definition.id)
      .concat(definition);
    try {
      // Validate the migrated state: values of removed fields are dropped the
      // same way saveDefinition applies them, so a removal preview never
      // fails just because existing records still carry the old values.
      setRows(
        candidate,
        definition.id,
        rowsOf(candidate, definition.id).map((row) => {
          const migrated = { ...row };
          for (const name of removed) delete migrated[name];
          return validateRecord(definition, migrated, { sanitize: false });
        }),
      );
      validateState(candidate);
    } catch (error) {
      errors.push(error.message);
    }
    return {
      definition,
      revision: revisionOf(data),
      count: rowsOf(data, definition.id).length,
      errors,
      warnings,
    };
  }
  async saveDefinition(input, revision) {
    return this.mutate(async (data) => {
      if (revision !== revisionOf(this.data()))
        throw new Error(
          "Data changed since preview. Preview again before applying.",
        );
      const preview = this.preview(input);
      if (preview.errors.length) throw new Error(preview.errors.join(" "));
      const state = data.dynamic,
        previous = definitionsOf(this.data()).find((d) => d.id === input.id);
      const removed = new Set(
        (previous?.fields || [])
          .filter(
            (f) =>
              !preview.definition.fields.some((n) => n.name === f.name),
          )
          .map((f) => f.name),
      );
      // Values of removed fields are migrated away: snapshot the whole
      // database first so the change stays reversible.
      const changes = schemaChanges(previous, preview.definition, this.data());
      const backup = preview.warnings.length
        ? await this.backup(input.id, this.data(), changes)
        : null;
      state.history.push({
        id: randomUUID(),
        collection: input.id,
        definition: previous || null,
        backup,
        savedAt: new Date().toISOString(),
      });
      state.history = state.history.slice(-100);
      state.definitions = state.definitions
        .filter((d) => d.id !== input.id)
        .concat(preview.definition);
      setRows(
        data,
        input.id,
        rowsOf(data, input.id).map((row) => {
          const migrated = { ...row };
          for (const name of removed) delete migrated[name];
          return validateRecord(preview.definition, migrated, {
            sanitize: false,
          });
        }),
      );
      return {
        definition: preview.definition,
        warnings: preview.warnings,
        backup,
        summary: changes.summary,
      };
    });
  }
  async deleteDefinition(id) {
    if (SYSTEM.includes(id))
      throw new Error("System collections are protected.");
    return this.mutate((data) => {
      if (rowsOf(data, id).length)
        throw new Error(
          "Delete records explicitly before deleting the collection.",
        );
      if (
        data.dynamic.views.some((v) => v.collection === id) ||
        data.dynamic.definitions.some((d) =>
          d.fields.some((f) => f.target === id),
        )
      )
        throw new Error("Collection is referenced by a view or relationship.");
      data.dynamic.definitions = data.dynamic.definitions.filter(
        (d) => d.id !== id,
      );
      delete data.dynamic.records[id];
    });
  }
  async saveRecord(
    collection,
    input,
    id,
    replace = false,
    { internal = false } = {},
  ) {
    if (LOCKED.includes(collection))
      throw new Error(
        "Authentication and site settings use protected administration.",
      );
    return this.mutate((data) => {
      const def = definitionsOf(data).find((d) => d.id === collection);
      if (!def) throw new Error("Collection not found.");
      assertSafe(input);
      if (!internal && SYSTEM_FIELDS.some((k) => Object.hasOwn(input, k)))
        throw new Error("System fields cannot be edited.");
      const rows = rowsOf(data, collection);
      const old = id ? rows.find((r) => r.id === id) : null;
      if (id && !old) throw new Error("Record not found.");
      const values = { ...(replace ? {} : old), ...input };
      const prepared = prepareRecord(collection, values, data, old, input);
      if (def.orderField && prepared[def.orderField] == null) {
        prepared[def.orderField] =
          old?.[def.orderField] ??
          Math.max(
            -1,
            ...rows.map((row) =>
              Number.isFinite(row[def.orderField]) ? row[def.orderField] : -1,
            ),
          ) + 1;
      }
      const record = validateRecord(def, {
        ...prepared,
        id: id || (internal && input.id) || randomUUID(),
        createdAt:
          old?.createdAt ||
          (internal && input.createdAt) ||
          new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (old) rows.splice(rows.indexOf(old), 1, record);
      else rows.push(record);
      setRows(data, collection, rows);
      afterWrite(collection, data);
      return record;
    });
  }
  async deleteRecord(collection, id) {
    if (LOCKED.includes(collection))
      throw new Error("System collection is protected.");
    return this.mutate((data) => {
      this.definition(collection);
      assertNotReferenced(data, collection, id);
      validateDeletion(collection, id, data);
      const existed = rowsOf(data, collection).some((r) => r.id === id);
      setRows(
        data,
        collection,
        rowsOf(data, collection).filter((r) => r.id !== id),
      );
      afterWrite(collection, data);
      return existed;
    });
  }
  async reorder(collection, ids, field = "order") {
    return this.mutate((data) => {
      const rows = rowsOf(data, collection);
      if (
        !Array.isArray(ids) ||
        ids.length !== rows.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !rows.some((r) => r.id === id))
      )
        throw new Error("The list changed. Reload before reordering.");
      const def = this.definition(collection);
      setRows(
        data,
        collection,
        ids.map((id, index) =>
          validateRecord(def, {
            ...rows.find((r) => r.id === id),
            [field]: index,
          }),
        ),
      );
    });
  }
}
export const collectionStore = new CollectionStore();
