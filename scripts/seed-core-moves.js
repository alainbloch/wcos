import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { initDatabase, movesRepo } from '../src/models/database.js';
export const coreMoveSeed = JSON.parse(fs.readFileSync(new URL('../src/content/core-moves.json', import.meta.url), 'utf8'));
const key = name => name.toLowerCase().replace(/\s*\/\s*/g, '/').trim();
export async function seedCoreMoves() {
  const existing = await movesRepo.findAll();
  let added = 0;
  for (const move of coreMoveSeed) {
    if (!existing.some(item => key(item.name) === key(move.name))) {
      existing.push(await movesRepo.create(move)); added++;
    }
  }
  return added;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await initDatabase();
  console.log(`Added ${await seedCoreMoves()} core moves. Existing moves were preserved.`);
}
