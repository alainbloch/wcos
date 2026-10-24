import { expect, it } from "@jest/globals";
import {
  readMemberForm,
  normalizeMerits,
  memberRecordToForm,
} from "../../src/utils/memberForm.js";

it("extracts only text from circular multipart fields", () => {
  const body = {};
  for (const [key, value] of Object.entries({
    circleName: "Wind",
    level: "L3",
    merits: "Council\nInstructor",
    active: "on",
    email: "wind@example.com",
  })) {
    body[key] = { type: "field", value, fields: body };
  }
  const form = readMemberForm(body);
  expect(form).toMatchObject({
    circleName: "Wind",
    level: "L3",
    merits: ["Council", "Instructor"],
    active: true,
    email: "wind@example.com",
  });
  expect(() => JSON.stringify(form)).not.toThrow();
});
it("never stringifies arbitrary objects into merits", () => {
  const cyclic = {};
  cyclic.fields = cyclic;
  expect(
    normalizeMerits([
      cyclic,
      null,
      42,
      " Valid ",
      { type: "file", value: "upload" },
    ]),
  ).toEqual(["Valid"]);
  expect(readMemberForm(null).active).toBe(false);
});
it.each([
  "Council\nInstructor",
  '["Council", "Instructor"]',
  ["Council", "Instructor"],
])("loads legacy merits consistently: %j", (merits) => {
  expect(
    memberRecordToForm({
      id: "123",
      position: "Wind",
      circleName: "L3",
      merits,
      active: false,
    }),
  ).toMatchObject({
    id: "123",
    circleName: "Wind",
    position: "Council",
    merits: ["Council", "Instructor"],
    active: false,
  });
});
