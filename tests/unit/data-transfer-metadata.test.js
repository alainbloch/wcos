import "../../src/app.js";
import { expect, it } from "@jest/globals";
import {
  COLLECTIONS,
  snapshotOf,
  inspectSnapshot,
  mergeCollections,
} from "../../src/services/dataTransfer/validation.js";

const database = () => Object.fromEntries(COLLECTIONS.map((key) => [key, []]));

it("round trips retired resources and the managed empty roster without mutating the source", () => {
  const source = {
    ...database(),
    resources: [{ id: "legacy", title: "Old resource" }],
    memberRosterManaged: true,
  };
  const snapshot = snapshotOf(source);
  expect(inspectSnapshot(snapshot, "restore")).toEqual([]);
  expect(snapshot.collections.resources).toBeUndefined();
  const { result } = mergeCollections(database(), snapshot, "restore");
  expect(result.resources).toEqual(source.resources);
  expect(result.memberRosterManaged).toBe(true);
  result.resources[0].title = "Changed";
  expect(source.resources[0].title).toBe("Old resource");
});

it("preserves explicit false and supports older backups without roster metadata", () => {
  const snapshot = snapshotOf({ ...database(), memberRosterManaged: false });
  expect(
    mergeCollections(database(), snapshot, "restore").result
      .memberRosterManaged,
  ).toBe(false);
  delete snapshot.system.memberRosterManaged;
  expect(
    mergeCollections(database(), snapshot, "restore").result
      .memberRosterManaged,
  ).toBe(true);
});

it.each(["populate", "override"])(
  "retains legacy data from both databases during %s",
  (mode) => {
    const current = {
      ...database(),
      resources: [{ id: "a" }],
      memberRosterManaged: true,
    };
    const snapshot = snapshotOf({
      ...database(),
      resources: [{ id: "b" }],
      memberRosterManaged: false,
    });
    const { result } = mergeCollections(current, snapshot, mode);
    expect(result.resources).toEqual([{ id: "a" }, { id: "b" }]);
    expect(result.memberRosterManaged).toBe(true);
    expect(mergeCollections(result, snapshot, mode).result.resources).toEqual(
      result.resources,
    );
  },
);

it("rejects malformed metadata and still rejects genuinely unknown collections", () => {
  const snapshot = snapshotOf(database());
  snapshot.system.memberRosterManaged = "true";
  expect(inspectSnapshot(snapshot, "restore")).toContain(
    "Invalid system metadata.",
  );
  snapshot.system = { resources: {} };
  expect(inspectSnapshot(snapshot, "restore")).toContain(
    "Invalid system metadata.",
  );
  expect(() => snapshotOf({ ...database(), unknown: [] })).toThrow(
    "Unsupported database collections: unknown",
  );
});
