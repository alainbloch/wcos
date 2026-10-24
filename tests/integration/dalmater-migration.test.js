import { it, expect } from "@jest/globals";
import { writeFile, readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import config from "../../src/config/index.js";
import { initDatabase, defaultData } from "../../src/models/database.js";
it("backs up and migrates dalmater data once without reseeding the removed collection", async () => {
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
  const db = await initDatabase();
  expect(db.data).not.toHaveProperty("dalmaterColors");
  expect(db.data.members[0].dalmaterColorName).toBe("Jade Green");
  const files = (await readdir(path.dirname(config.dbPath))).filter((f) =>
    f.includes(".backup-dalmater-"),
  );
  expect(files).toHaveLength(1);
  expect(
    JSON.parse(
      await readFile(path.join(path.dirname(config.dbPath), files[0]), "utf8"),
    ),
  ).toEqual(legacy);
  await initDatabase();
  expect(
    (await readdir(path.dirname(config.dbPath))).filter((f) =>
      f.includes(".backup-dalmater-"),
    ),
  ).toHaveLength(1);
  expect(JSON.parse(await readFile(config.dbPath, "utf8")).members).toEqual(
    db.data.members,
  );
});
