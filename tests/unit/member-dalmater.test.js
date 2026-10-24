import { it, expect } from "@jest/globals";
import {
  normalizeHex,
  kaidenColorOptions,
  prepareDalmater,
} from "../../src/utils/memberDalmater.js";
import { mergeDalmaterColors } from "../../src/models/migrations/mergeDalmaterColors.js";
const teacher = {
  id: "teacher",
  position: "Teacher",
  merits: ["Head Kaiden"],
  dalmaterColorName: "Green",
  dalmaterColorHex: "#00ff00",
};
it("normalizes hex and accepts only complete colors from Kaiden-ranked members", () => {
  expect(normalizeHex("#abc")).toBe("#AABBCC");
  expect(normalizeHex("red")).toBe("");
  expect(normalizeHex("#12345g")).toBe("");
  expect(
    kaidenColorOptions([
      teacher,
      { ...teacher, id: "other", merits: ["Assistant to Kaiden"] },
      { ...teacher, id: "incomplete", dalmaterColorHex: "" },
    ]),
  ).toEqual([
    { id: "teacher", name: "Teacher", colorName: "Green", colorHex: "#00FF00" },
  ]);
  expect(kaidenColorOptions([teacher], "teacher")).toEqual([]);
});
it("copies the selected color, ignores spoofed values, validates custom colors and rejects self-selection", () => {
  expect(
    prepareDalmater(
      {
        dalmaterMode: "kaiden",
        dalmaterKaidenId: "teacher",
        dalmaterColorHex: "evil",
        dalmaterColorName: "Wrong",
      },
      [teacher],
      "student",
    ),
  ).toMatchObject({ dalmaterColorHex: "#00FF00", dalmaterColorName: "Green" });
  expect(() =>
    prepareDalmater(
      { dalmaterMode: "kaiden", dalmaterKaidenId: "teacher" },
      [teacher],
      "teacher",
    ),
  ).toThrow("Select a Kaiden");
  expect(() =>
    prepareDalmater({ dalmaterMode: "kaiden", dalmaterKaidenId: "missing" }, [
      teacher,
    ]),
  ).toThrow("Select a Kaiden");
  expect(
    prepareDalmater(
      {
        dalmaterMode: "custom",
        dalmaterColorName: " Jade ",
        dalmaterColorHex: "#abc",
        dalmaterKaidenId: "teacher",
      },
      [],
    ),
  ).toMatchObject({
    dalmaterColorName: "Jade",
    dalmaterColorHex: "#AABBCC",
    dalmaterKaidenId: "",
  });
  expect(() =>
    prepareDalmater(
      {
        dalmaterMode: "custom",
        dalmaterColorName: "Green",
        dalmaterColorHex: "green",
      },
      [],
    ),
  ).toThrow("valid hex");
  expect(() =>
    prepareDalmater(
      {
        dalmaterMode: "custom",
        dalmaterColorName: "",
        dalmaterColorHex: "#000000",
      },
      [],
    ),
  ).toThrow("color name");
  expect(() => prepareDalmater({ dalmaterMode: "invalid" }, [])).toThrow(
    "valid dalmater",
  );
  expect(prepareDalmater({ biography: "Edit" }, [])).toEqual({
    biography: "Edit",
  });
});
it("migrates matching colors without inventing hex codes or overwriting existing profiles", () => {
  const data = {
    members: [
      { id: "g", position: "Gad", merits: ["Head Kaiden"], biography: "Keep" },
      { ...teacher },
    ],
    dalmaterColors: [
      {
        id: "a",
        kaiden: "Head Kaiden Gad",
        color: "Jade Green",
        kaidenOrder: 1,
      },
      {
        id: "b",
        kaiden: "Honorary Kaiden New (retired)",
        color: "#123",
        colorName: "Custom",
      },
      { id: "c", kaiden: "Kaiden Teacher", color: "#000000" },
      { kaiden: "Red Dalmater", isRedDalmater: true, requirements: ["Rules"] },
    ],
  };
  expect(mergeDalmaterColors(data)).toBe(true);
  expect(data).not.toHaveProperty("dalmaterColors");
  expect(data.members).toHaveLength(3);
  expect(data.members[0]).toMatchObject({
    dalmaterColorName: "Jade Green",
    dalmaterColorHex: "",
    biography: "Keep",
  });
  expect(data.members[1].dalmaterColorHex).toBe("#00ff00");
  expect(data.members[2]).toMatchObject({
    position: "New",
    active: false,
    merits: ["Kaiden"],
    dalmaterColorName: "Custom",
    dalmaterColorHex: "#112233",
  });
  expect(data.members[0].dalmaterLegacyRecords[0].kaidenOrder).toBe(1);
  expect(
    prepareDalmater(
      {
        dalmaterMode: "custom",
        dalmaterColorName: "Jade Green",
        dalmaterColorHex: "",
      },
      data.members,
      "g",
    ).dalmaterColorHex,
  ).toBe("");
  const before = structuredClone(data);
  expect(mergeDalmaterColors(data)).toBe(false);
  expect(data).toEqual(before);
});
it("keeps ambiguous identities separate and rejects malformed legacy collections", () => {
  const data = {
    members: [
      { id: "a", position: "Same" },
      { id: "b", position: "Same" },
    ],
    dalmaterColors: [{ kaiden: "Kaiden Same", color: "#123456" }],
  };
  mergeDalmaterColors(data);
  expect(data.members).toHaveLength(3);
  expect(data.members[0]).not.toHaveProperty("dalmaterColorHex");
  expect(() => mergeDalmaterColors({ dalmaterColors: {} })).toThrow(
    "must be an array",
  );
});
