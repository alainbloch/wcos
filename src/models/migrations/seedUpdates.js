import fs from "node:fs";
import { randomUUID } from "node:crypto";
export const updatesSeed = JSON.parse(
  fs.readFileSync(
    new URL("../../content/updates.json", import.meta.url),
    "utf8",
  ),
);
export function seedUpdates(data) {
  data.updates ||= [];
  for (const item of updatesSeed) {
    if (
      !data.updates.some(
        (old) =>
          old.sourceKey === item.sourceKey ||
          (old.category === item.category &&
            old.date === item.date &&
            old.body === item.body),
      )
    ) {
      data.updates.push({ ...item, id: `updates_${randomUUID()}` });
    }
  }
  data.migrations ||= {};
  data.migrations.updates = true;
}
