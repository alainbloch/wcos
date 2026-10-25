import { it, expect } from "@jest/globals";
import { writeFile, readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import config from "../../src/config/index.js";
import { initDatabase, defaultData } from "../../src/models/database.js";
it("leaves legacy dalmaterColors unchanged on startup", async () => {
  const legacy = {
    ...structuredClone(defaultData),
    members: [{ id: "a", position: "Gad", merits: ["Head Kaiden"] }],
    dalmaterColors: [
      { kaiden: "Head Kaiden Gad", color: "Jade Green" },
      {
        kaiden: "Red Dalmater",
        isRedDalmater: true,
        requirements: ["Keep rules"],
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
