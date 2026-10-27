import collectionSchemas from "../../schemas/collections.json" with { type: "json" };
import Ajv from "ajv";
import sanitizeHtml from "sanitize-html";

const ajv = new Ajv({ allErrors: true, strict: true, useDefaults: true });
ajv.addKeyword({ keyword: "x-wcos", valid: true });
const validators = new Map();
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
export const TYPES = [
  "string",
  "text",
  "richtext",
  "number",
  "boolean",
  "date",
  "enum",
  "array",
  "object",
  "media",
  "relationship",
];
export const SYSTEM = [
  "pages",
  "members",
  "classes",
  "glossary",
  "updates",
  "moves",
  "siteSettings",
  "users",
];
export const LOCKED = ["users", "siteSettings"];
export const CONTENT = SYSTEM.filter((id) => !LOCKED.includes(id));
export const SYSTEM_FIELDS = ["id", "createdAt", "updatedAt"];
export function assertSafe(value, depth = 0) {
  if (depth > 20) throw new Error("Data nesting exceeds 20 levels.");
  if (typeof value === "string" && value.length > 2000000)
    throw new Error("Value too large.");
  if (value && typeof value === "object") {
    if (
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) !== null &&
      Object.getPrototypeOf(Object.getPrototypeOf(value)) !== null
    )
      throw new Error("Plain JSON objects required.");
    for (const key of Object.keys(value)) {
      if (forbidden.has(key)) throw new Error(`Unsafe key: ${key}`);
      assertSafe(value[key], depth + 1);
    }
  }
}
export function identifier(value) {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z][a-zA-Z0-9_\-]{0,63}$/.test(value) ||
    forbidden.has(value)
  )
    throw new Error(
      "Use an identifier starting with a letter (maximum 64 characters).",
    );
  return value;
}
export function normalizeDefinition(input) {
  assertSafe(input);
  const id = identifier(input.id);
  if (
    LOCKED.includes(id) ||
    ["dynamic", "resources", "migrations"].includes(id)
  )
    throw new Error("System collections are protected.");
  if (!input.label?.trim() || input.label.length > 120)
    throw new Error("Enter a collection label.");
  if (!Array.isArray(input.fields) || input.fields.length > 100)
    throw new Error("Use at most 100 fields.");
  const names = new Set();
  const fields = input.fields.map((raw, index) => {
    const name = identifier(raw.name);
    if (SYSTEM_FIELDS.includes(name) || names.has(name))
      throw new Error(`Reserved or duplicate field: ${name}`);
    names.add(name);
    if (!TYPES.includes(raw.type)) throw new Error(`Unknown type for ${name}`);
    const field = {
      name,
      label: String(raw.label || name).slice(0, 120),
      type: raw.type,
      order: index,
      required: raw.required === true,
      unique: raw.unique === true,
    };
    for (const key of [
      "default",
      "min",
      "max",
      "pattern",
      "options",
      "target",
      "cardinality",
      "control",
      "nullable",
      "optionRule",
      "group",
      "itemTemplate",
      "items",
    ])
      if (raw[key] !== undefined && raw[key] !== "")
        field[key] = structuredClone(raw[key]);
    for (const key of ["min", "max"])
      if (
        field[key] !== undefined &&
        (!Number.isFinite(field[key]) ||
          (raw.type !== "number" &&
            (!Number.isInteger(field[key]) || field[key] < 0)))
      )
        throw new Error(`Invalid ${key} for ${name}`);
    if (
      field.min !== undefined &&
      field.max !== undefined &&
      field.min > field.max
    )
      throw new Error(`Minimum exceeds maximum: ${name}`);
    // Restrict patterns to a linear subset: no groups, alternation, backreferences or repeated wildcards.
    if (field.pattern) {
      if (
        typeof field.pattern !== "string" ||
        field.pattern.length > 128 ||
        /[()|]|\\[1-9]|\.\*|\.\+/.test(field.pattern) ||
        (field.pattern.match(/[+*{]/g) || []).length > 1
      )
        throw new Error(
          `Unsupported regex for ${name}; use a simple anchored character pattern.`,
        );
      new RegExp(field.pattern);
    }
    if (
      field.type === "enum" &&
      (!Array.isArray(field.options) ||
        !field.options.length ||
        field.options.length > 100 ||
        field.options.some((v) => typeof v !== "string"))
    )
      throw new Error(`Enter enum choices for ${name}`);
    if (field.type === "relationship" || field.control === "reference") {
      identifier(field.target);
      if (["users", "siteSettings", "pages"].includes(field.target))
        throw new Error(
          "Relationships to private system collections are not allowed.",
        );
      if (
        field.type === "relationship" &&
        !["one-to-one", "many-to-one", "one-to-many", "many-to-many"].includes(
          field.cardinality,
        )
      )
        throw new Error(`Choose relationship cardinality for ${name}`);
    }
    if (
      field.options !== undefined &&
      (!Array.isArray(field.options) ||
        field.options.length > 100 ||
        field.options.some((v) => typeof v !== "string"))
    )
      throw new Error(`Invalid choices for ${name}`);
    if (
      field.group !== undefined &&
      (typeof field.group !== "string" || field.group.length > 120)
    )
      throw new Error(`Invalid group for ${name}`);
    if (field.type === "richtext" && typeof field.default === "string")
      field.default = sanitizeHtml(field.default);
    return field;
  });
  const columns = input.columns || fields.slice(0, 4).map((f) => f.name);
  if (!Array.isArray(columns) || columns.some((c) => !names.has(c)))
    throw new Error("List columns must refer to defined fields.");
  const definition = {
    id,
    label: input.label.trim(),
    fields,
    columns,
    system: SYSTEM.includes(id),
    locked: false,
    presentationVersion: 1,
    singularLabel: String(input.singularLabel || input.label).slice(0, 120),
    description: String(input.description || "").slice(0, 500),
    ...(input.orderField ? { orderField: input.orderField } : {}),
  };
  if (
    definition.orderField &&
    !fields.some((f) => f.name === definition.orderField && f.type === "number")
  )
    throw new Error("Ordering requires a numeric field.");
  definition.jsonSchema = jsonSchema(definition);
  ajv.compile(definition.jsonSchema);
  return definition;
}
export function jsonSchema(definition) {
  const properties = Object.fromEntries(
    SYSTEM_FIELDS.map((k) => [k, { type: "string" }]),
  );
  for (const f of definition.fields) {
    let schema;
    if (f.type === "relationship")
      schema = ["one-to-one", "many-to-one"].includes(f.cardinality)
        ? { type: "string" }
        : {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
            maxItems: 1000,
          };
    else if (f.type === "array")
      schema = {
        type: "array",
        maxItems: 1000,
        ...(f.options?.length
          ? { items: { type: "string", enum: f.options }, uniqueItems: true }
          : {}),
      };
    else if (f.type === "object") schema = { type: "object" };
    else if (["number", "boolean"].includes(f.type)) schema = { type: f.type };
    else
      schema = {
        type: "string",
        maxLength:
          f.type === "richtext" || f.type === "text"
            ? SYSTEM.includes(definition.id)
              ? 2000000
              : 100000
            : 10000,
      };
    if (f.items && schema.type === "array")
      schema.items = structuredClone(f.items);
    if (f.options?.length && schema.type === "string")
      schema.enum = [...(f.required ? [] : [""]), ...f.options];
    if (f.type === "date") schema.pattern = "^\\d{4}-\\d{2}-\\d{2}$";
    if (f.type === "media")
      schema.pattern = f.required
        ? "^(https?://[^\\s]+|/(uploads|images)/[^\\s]+)$"
        : "^(https?://[^\\s]+|/(uploads|images)/[^\\s]+|)$";
    if (f.pattern) schema.pattern = f.pattern;
    if (f.required && schema.type === "string") schema.minLength = 1;
    if (f.min !== undefined)
      schema[
        schema.type === "number"
          ? "minimum"
          : schema.type === "array"
            ? "minItems"
            : "minLength"
      ] = f.min;
    if (f.max !== undefined)
      schema[
        schema.type === "number"
          ? "maximum"
          : schema.type === "array"
            ? "maxItems"
            : "maxLength"
      ] = f.max;
    if (f.default !== undefined) schema.default = f.default;
    if (f.type === "relationship" && schema.type === "string" && !f.required) {
      /* Empty optional references remain valid legacy values. */
    }
    if (f.nullable && !f.required) {
      schema.type = [schema.type, "null"];
      if (schema.enum) schema.enum = [...schema.enum, null];
    }
    schema.title = f.label;
    schema["x-wcos"] = Object.fromEntries(
      [
        "type",
        "control",
        "group",
        "target",
        "cardinality",
        "optionRule",
        "unique",
      ]
        .filter((key) => f[key] !== undefined)
        .map((key) => [key, f[key]]),
    );
    properties[f.name] = schema;
  }
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: definition.label || "Collection",
    description: definition.description || "",
    "x-wcos": {
      singularLabel: definition.singularLabel || definition.label || "Record",
      columns: definition.columns || [],
      ...(definition.orderField ? { orderField: definition.orderField } : {}),
    },
    type: "object",
    properties,
    required: definition.fields.filter((f) => f.required).map((f) => f.name),
    additionalProperties: definition.legacy === true,
  };
}
export function validateRecord(definition, input, { sanitize = true } = {}) {
  assertSafe(input);
  const record = structuredClone(input);
  const schema = jsonSchema(definition),
    key = JSON.stringify(schema);
  if (!validators.has(key)) {
    if (validators.size > 200) validators.clear();
    validators.set(key, ajv.compile(schema));
  }
  const validate = validators.get(key);
  if (!validate(record)) {
    const error = new Error("Record validation failed.");
    error.fields = Object.fromEntries(
      validate.errors.map((e) => [
        e.params.missingProperty || e.instancePath.split("/")[1] || "_record",
        e.message,
      ]),
    );
    throw error;
  }
  for (const f of definition.fields) {
    if (
      sanitize &&
      f.type === "richtext" &&
      record[f.name] != null &&
      !(builtins[definition.id]?.[f.name] === "richtext")
    )
      record[f.name] = sanitizeHtml(record[f.name]);
    if (f.type === "date" && record[f.name] != null) {
      const date = new Date(record[f.name]);
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== record[f.name]
      ) {
        const error = new Error(`Invalid date: ${f.label}`);
        error.fields = { [f.name]: "Enter a valid calendar date." };
        throw error;
      }
    }
  }
  return record;
}
// JSON Schemas own both validation and editor annotations. Fields are a generic
// compatibility projection for the visual builder, never a second preset registry.
const humanLabel = (value) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
function itemDefaults(schema) {
  if (schema.default !== undefined) return structuredClone(schema.default);
  if (schema.type === "object")
    return Object.fromEntries(
      Object.entries(schema.properties || {}).map(([key, property]) => [
        key,
        itemDefaults(property),
      ]),
    );
  return schema.type === "number" || schema.type === "integer"
    ? 0
    : schema.type === "boolean"
      ? false
      : schema.type === "array"
        ? []
        : "";
}
export function fieldsFromSchema(schema) {
  return Object.entries(schema.properties || {})
    .filter(([name]) => !SYSTEM_FIELDS.includes(name))
    .map(([name, property], order) => {
      const raw = property.anyOf?.find((p) => p.type !== "null") || property;
      const value = {
        ...raw,
        type: Array.isArray(raw.type)
          ? raw.type.find((type) => type !== "null")
          : raw.type,
      };
      const annotations = property["x-wcos"] || {};
      const field = {
        name,
        label: property.title || humanLabel(name),
        order,
        type: annotations.type || (value.enum ? "enum" : value.type),
        ...annotations,
        required: (schema.required || []).includes(name),
        nullable:
          property.anyOf?.some((p) => p.type === "null") ||
          (Array.isArray(raw.type) && raw.type.includes("null")) ||
          false,
      };
      if (value.default !== undefined)
        field.default = structuredClone(value.default);
      if (value.enum)
        field.options = value.enum.filter((v) => v !== "" && v !== null);
      if (value.items?.enum) field.options = [...value.items.enum];
      if (value.items && !value.items.enum && value.type === "array") {
        field.items = structuredClone(value.items);
        if (value.items.type === "object")
          field.itemTemplate = itemDefaults(value.items);
      }
      if (value.pattern && !["media", "date"].includes(field.type))
        field.pattern = value.pattern;
      const min = value.minimum ?? value.minItems ?? value.minLength;
      const max = value.maximum ?? value.maxItems ?? value.maxLength;
      if (min !== undefined) field.min = min;
      if (max !== undefined) field.max = max;
      return field;
    });
}
export const builtins = Object.fromEntries(
  Object.entries(collectionSchemas).map(([id, schema]) => [
    id,
    Object.fromEntries(fieldsFromSchema(schema).map((f) => [f.name, f.type])),
  ]),
);
export function systemDefinitions(data) {
  return SYSTEM.map((id) => {
    const source = structuredClone(collectionSchemas[id]);
    const fields = new Map(fieldsFromSchema(source).map((f) => [f.name, f]));
    for (const row of data[id] || [])
      for (const [name, value] of Object.entries(row)) {
        if (
          SYSTEM_FIELDS.includes(name) ||
          forbidden.has(name) ||
          id === "users" ||
          fields.has(name)
        )
          continue;
        fields.set(name, {
          name,
          label: humanLabel(name),
          type: Array.isArray(value)
            ? "array"
            : value && typeof value === "object"
              ? "object"
              : ["number", "boolean"].includes(typeof value)
                ? typeof value
                : "string",
          nullable: true,
        });
      }
    const definition = {
      id,
      label: source.title,
      description: source.description || "",
      ...source["x-wcos"],
      system: true,
      locked: LOCKED.includes(id),
      legacy: true,
      fields: [...fields.values()],
    };
    definition.jsonSchema = jsonSchema(definition);
    return definition;
  });
}
function systemSchema(id) {
  return {
    type: "object",
    properties: Object.fromEntries(
      Object.entries(builtins[id] || {}).map(([name, type]) => [
        name,
        {
          type: [
            ["array", "object", "number", "boolean"].includes(type)
              ? type
              : "string",
            "null",
          ],
        },
      ]),
    ),
    additionalProperties: true,
  };
}
export function validateSystemRecord(collection, record) {
  // Preserve existing specialized rules and legacy optional/null fields. Credentials remain owned by auth.
  if (!SYSTEM.includes(collection) || collection === "users") return;
  assertSafe(record);
  const key = `system:${collection}`;
  if (!validators.has(key))
    validators.set(key, ajv.compile(systemSchema(collection)));
  if (!validators.get(key)(record))
    throw new Error(
      `Invalid ${collection} record: ${ajv.errorsText(validators.get(key).errors)}`,
    );
}
