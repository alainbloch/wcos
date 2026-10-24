/** Install the complete migration, keeping a dated backup before replacements. */
import fs from "node:fs/promises";
import config from "../src/config/index.js";
import { initDatabase, getDatabase } from "../src/models/database.js";
import {
  originalPages,
  ensureReferencePages,
} from "../src/services/referenceSiteService.js";
await initDatabase();
const db = getDatabase();
if (process.argv.includes("--replace")) {
  const backup = `${config.dbPath}.backup-${Date.now()}`;
  await fs.writeFile(backup, JSON.stringify(db.data, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  for (const source of originalPages) {
    const index = db.data.pages.findIndex((page) => page.slug === source.slug);
    const page = { ...source, migrated: true };
    if (index < 0) db.data.pages.push(page);
    else db.data.pages[index] = { ...db.data.pages[index], ...page };
  }
  db.data.referenceMigrationVersion = 1;
  await db.write();
  console.log(
    `Restored ${originalPages.length} original pages. Previous database saved to ${backup}.`,
  );
} else {
  await ensureReferencePages();
  console.log("Missing source pages installed; existing content preserved.");
}
