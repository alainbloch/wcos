import { it, expect } from "@jest/globals";
import {
  councilMembers,
  currentCouncilMembers,
} from "../../src/utils/councilMembership.js";
import { mergeCouncilMembers } from "../../src/models/migrations/mergeCouncilMembers.js";

it("filters council service separately from active roster status", () => {
  const members = [
    { id: "ordinary", active: true, merits: ["Council"] },
    { id: "past", councilTermStart: "2005", councilTermEnd: "2007" },
    { id: "end-only", councilTermEnd: "2010" },
    { id: "historical", councilHistoricalDate: "2005-07-23" },
    { id: "current", councilCurrent: true, active: false },
    {
      id: "future-unconfirmed",
      councilTermStart: "2030",
      councilCurrent: false,
    },
    { id: "whitespace", councilTermStart: "  ", councilCurrent: "false" },
  ];
  expect(councilMembers(members).map((m) => m.id)).toEqual([
    "past",
    "end-only",
    "historical",
    "current",
    "future-unconfirmed",
  ]);
  expect(currentCouncilMembers(members).map((m) => m.id)).toEqual(["current"]);
  expect(councilMembers(null)).toEqual([]);
});
it("merges matching identities, retains term history, and does not overwrite shared details", () => {
  const data = {
    members: [
      {
        id: "existing",
        position: "Steel Wind",
        biography: "Member biography",
        image: "/existing.jpg",
        active: true,
      },
    ],
    councilMembers: [
      {
        id: "old",
        name: "Kaiden Steel Wind",
        position: "Secretary",
        title: "Kaiden",
        termStart: "2004",
        termEnd: "2006",
        current: false,
        bio: "Old bio",
        image: "/old.jpg",
      },
      {
        id: "new",
        name: "Steel Wind",
        position: "Chair",
        termStart: "2024",
        current: "on",
      },
      { name: "Council Formation", historicalDate: "2005-07-23" },
      {
        id: "unknown",
        name: "New Person",
        bio: "Biography",
        historicalDate: "2015",
        current: "false",
      },
    ],
  };
  expect(mergeCouncilMembers(data)).toBe(true);
  expect(data).not.toHaveProperty("councilMembers");
  expect(data.members).toHaveLength(2);
  expect(data.members[0]).toMatchObject({
    id: "existing",
    position: "Steel Wind",
    biography: "Member biography",
    image: "/existing.jpg",
    councilPosition: "Chair",
    councilTermStart: "2024",
    councilCurrent: true,
    active: true,
  });
  expect(data.members[0].councilHistory).toHaveLength(2);
  expect(data.members[1]).toMatchObject({
    position: "New Person",
    biography: "Biography",
    active: false,
    councilCurrent: false,
  });
  const before = structuredClone(data);
  expect(mergeCouncilMembers(data)).toBe(false);
  expect(data).toEqual(before);
});
it("does not arbitrarily merge duplicate names or discard malformed collections", () => {
  const data = {
    members: [
      { id: "a", position: "Same" },
      { id: "b", position: "Same" },
    ],
    councilMembers: [{ name: "Same", termStart: "2005" }],
  };
  mergeCouncilMembers(data);
  expect(data.members).toHaveLength(3);
  expect(data.members[0]).not.toHaveProperty("councilHistory");
  expect(() => mergeCouncilMembers({ councilMembers: {} })).toThrow(
    "must be an array",
  );
});
