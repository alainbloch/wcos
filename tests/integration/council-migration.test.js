import { it, expect } from "@jest/globals";
import { writeFile, readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import config from "../../src/config/index.js";
import { initDatabase, defaultData } from "../../src/models/database.js";

it("backs up legacy data before consolidation, persists it, and only migrates once", async () => {
  const legacy = {
    ...structuredClone(defaultData),
    members: [{ id: "m", position: "Person", active: true }],
    councilMembers: [
      { id: "c", name: "Person", termStart: "2020", current: true },
      {
        name: "Council Formation",
        historicalDate: "2005",
        description: "History",
      },
    ],
  };
  await mkdir(path.dirname(config.dbPath), { recursive: true });
  await writeFile(config.dbPath, JSON.stringify(legacy));
  const db = await initDatabase();
  expect(db.data.members[0].councilCurrent).toBe(true);
  expect(db.data).not.toHaveProperty("councilMembers");
  const files = (await readdir(path.dirname(config.dbPath))).filter((f) =>
    f.includes(".backup-council-"),
  );
  expect(files).toHaveLength(1);
  expect(
    JSON.parse(
      await readFile(path.join(path.dirname(config.dbPath), files[0]), "utf8"),
    ),
  ).toEqual(legacy);
  expect(JSON.parse(await readFile(config.dbPath, "utf8"))).toEqual(db.data);
  await initDatabase();
  expect(
    (await readdir(path.dirname(config.dbPath))).filter((f) =>
      f.includes(".backup-council-"),
    ),
  ).toHaveLength(1);
});
