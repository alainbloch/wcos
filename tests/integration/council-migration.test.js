import { it, expect } from "@jest/globals";
import { writeFile, readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import config from "../../src/config/index.js";
import { initDatabase, defaultData } from "../../src/models/database.js";

it("leaves legacy councilMembers unchanged on startup", async () => {
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
  const before = await readFile(config.dbPath, "utf8");
  const db = await initDatabase();
  expect(db.data).toEqual(legacy);
  await initDatabase();
  expect(await readFile(config.dbPath, "utf8")).toBe(before);
  expect((await readdir(path.dirname(config.dbPath))).filter(f => f.includes('.backup-'))).toHaveLength(0);
});
