import { pathToFileURL } from 'node:url';
import { initDatabase, getDatabase } from '../src/models/database.js';
import { migrateClasses } from '../src/models/migrations/classesInstructors.js';
export async function seedClasses() {
  const db=getDatabase(), previous=db.data;
  const next=structuredClone(previous);migrateClasses(next);db.data=next;
  try { await db.write(); } catch(error) { db.data=previous;throw error; }
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) { await initDatabase();await seedClasses();console.log('Classes seeded; existing edits preserved.'); }
