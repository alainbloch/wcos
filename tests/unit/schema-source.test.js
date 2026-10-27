import { it, expect } from "@jest/globals";
import {
  systemDefinitions,
  fieldsFromSchema,
  normalizeDefinition,
  validateRecord,
} from "../../src/services/collections/schema.js";
import { CollectionStore } from "../../src/services/collections/store.js";

it("owns choices, labels, ordering, sections and item defaults in JSON Schema", () => {
  const defs = systemDefinitions({});
  const moves = defs.find((d) => d.id === "moves");
  expect(moves.jsonSchema.properties.types.items.enum).toEqual([
    "Straight Offense",
    "Offensive Defense",
    "Initiated Response",
  ]);
  expect(moves.jsonSchema.properties.types.title).toBe("Move types");
  expect(moves.jsonSchema.properties.types["x-wcos"].control).toBe(
    "multiselect",
  );
  expect(moves.jsonSchema.properties.media.items.properties.type.default).toBe(
    "image",
  );
  expect(moves.jsonSchema["x-wcos"].columns).toEqual(["name", "core", "types"]);
  const members = defs.find((d) => d.id === "members");
  expect(members.jsonSchema.properties.level.enum).toContain("L7");
  expect(members.jsonSchema.properties.councilCurrent["x-wcos"].group).toBe(
    "Council",
  );
  expect(
    fieldsFromSchema(moves.jsonSchema).find((f) => f.name === "media")
      .itemTemplate,
  ).toEqual({ type: "image", url: "", caption: "" });
});
it("uses edited schema choices and defaults for both the form projection and validation", () => {
  const schema = structuredClone(
    systemDefinitions({}).find((d) => d.id === "moves").jsonSchema,
  );
  schema.properties.types.items.enum = ["Practice"];
  schema.properties.types.default = ["Practice"];
  schema.properties.types.title = "Training categories";
  const definition = normalizeDefinition({
    id: "practice",
    label: "Practice",
    fields: fieldsFromSchema(schema),
    columns: ["name", "types"],
  });
  expect(definition.fields.find((f) => f.name === "types").options).toEqual([
    "Practice",
  ]);
  expect(validateRecord(definition, {}).types).toEqual(["Practice"]);
  expect(() =>
    validateRecord(definition, { types: ["Initiated Response"] }),
  ).toThrow("validation");
});
it("keeps edited existing schemas through persistence and JSON export/import without preset overrides", async () => {
  let data = { moves: [] };
  const store = new CollectionStore({
    read: () => data,
    commit: async (candidate) => {
      data = candidate;
    },
  });
  const definition = store.definition("moves");
  definition.fields.find((f) => f.name === "types").options = ["Training"];
  definition.fields.find((f) => f.name === "types").label =
    "Training categories";
  await store.saveDefinition(definition, store.preview(definition).revision);
  const restored = new CollectionStore({
    read: () => JSON.parse(JSON.stringify(data)),
    commit: async () => {},
  });
  expect(
    restored.definition("moves").jsonSchema.properties.types.items.enum,
  ).toEqual(["Training"]);
  expect(
    restored.definition("moves").fields.find((f) => f.name === "types").label,
  ).toBe("Training categories");
  expect(data.moves).toEqual([]);
  await store.saveRecord("moves", {
    name: "Training move",
    types: ["Training"],
  });
  expect(store.rows("moves")[0].types).toEqual(["Training"]);
});
