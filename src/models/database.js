import { migrateEditableLayout } from './migrations/editableLayout.js';
import { mergeMemberHonors } from './migrations/mergeMemberHonors.js';
import { seedGlossary } from './migrations/seedGlossary.js';
import { existsSync } from 'node:fs';
import { migrateClasses, retiredCollections } from './migrations/classesInstructors.js';
/**
 * Database Service
 * Lowdb JSON file database with repository pattern
 */
import { renameMoves } from './migrations/renameMoves.js';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { mkdir, writeFile } from 'node:fs/promises';
import { mergeDalmaterColors } from './migrations/mergeDalmaterColors.js';
import { mergeCouncilMembers } from './migrations/mergeCouncilMembers.js';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default schema
export const defaultData = {
  pages: [],
  members: [],
  classes: [],
  glossary: [],
  moves: [],
  resources: [],
  siteSettings: {
    siteName: 'Western Circle of Swordfighters',
    siteEmail: 'westerncouncil@gmail.com',
    heroTitle: 'WESTERN CIRCLE OF SWORDFIGHTERS',
    heroSubtitle: 'experts',
    dojosText: 'DOJOS IN CA, OR, WA, NV AND KY',
  },
  users: [],
};

let dbInstance = null;

/**
 * Initialize database connection
 */
export async function initDatabase() {
  const dbPath = path.resolve(config.dbPath);
  await mkdir(path.dirname(dbPath), { recursive: true });
  const adapter = new JSONFile(dbPath);
  dbInstance = new Low(adapter, structuredClone(defaultData));
  await dbInstance.read();

  // Initialize with default data if empty
  if (!dbInstance.data || Object.keys(dbInstance.data).length === 0) {
    dbInstance.data = defaultData;
    await dbInstance.write();
  }

  // Back up before the one-time consolidation; migrate a copy so failures leave
  // the loaded data intact. Lowdb persists the completed migration atomically.
  if (Object.hasOwn(dbInstance.data, 'councilMembers')) {
    await writeFile(`${dbPath}.backup-council-${Date.now()}`, JSON.stringify(dbInstance.data, null, 2), { flag: 'wx', mode: 0o600 });
    const migrated = structuredClone(dbInstance.data);
    mergeCouncilMembers(migrated);
    dbInstance.data = migrated;
    await dbInstance.write();
  }

  if (Object.hasOwn(dbInstance.data, 'dalmaterColors')) {
    await writeFile(`${dbPath}.backup-dalmater-${Date.now()}`, JSON.stringify(dbInstance.data, null, 2), { flag: 'wx', mode: 0o600 });
    const migrated = structuredClone(dbInstance.data);
    mergeDalmaterColors(migrated);
    dbInstance.data = migrated;
    await dbInstance.write();
  }

  if (Object.hasOwn(dbInstance.data, 'coreMoves')) {
    await writeFile(`${dbPath}.backup-moves-${Date.now()}`, JSON.stringify(dbInstance.data, null, 2), { flag: 'wx', mode: 0o600 });
    const migrated = structuredClone(dbInstance.data);
    renameMoves(migrated);
    dbInstance.data = migrated;
    await dbInstance.write();
  }

  if (retiredCollections.some(key => Object.hasOwn(dbInstance.data, key)) || (dbInstance.data.classes?.length && !dbInstance.data.migrations?.classesInstructors)) {
    await writeFile(`${dbPath}.backup-classes-${Date.now()}`, JSON.stringify(dbInstance.data, null, 2), { flag: 'wx', mode: 0o600 });
    const migrated = structuredClone(dbInstance.data);
    migrateClasses(migrated);
    dbInstance.data = migrated;
    await dbInstance.write();
  }

  if (!dbInstance.data.migrations?.glossary) {
    if (existsSync(dbPath)) await writeFile(`${dbPath}.backup-glossary-${Date.now()}`, JSON.stringify(dbInstance.data, null, 2), { flag: 'wx', mode: 0o600 });
    const migrated=structuredClone(dbInstance.data);
    seedGlossary(migrated);
    dbInstance.data=migrated;
    await dbInstance.write();
  }

  if (Object.hasOwn(dbInstance.data, 'champions') || (!dbInstance.data.migrations?.memberHonors && dbInstance.data.members?.length)) {
    if (existsSync(dbPath)) await writeFile(`${dbPath}.backup-honors-${Date.now()}`, JSON.stringify(dbInstance.data, null, 2), { flag: 'wx', mode: 0o600 });
    const migrated=structuredClone(dbInstance.data);
    mergeMemberHonors(migrated);
    dbInstance.data=migrated;
    await dbInstance.write();
  }

  // Earlier versions seeded these two collections as objects even though their
  // repositories use array operations. Normalize once without discarding values.
  let normalized = false;
  for (const key of ['siteSettings']) {
    if (!Array.isArray(dbInstance.data[key])) {
      dbInstance.data[key] = [{ id: key, ...(dbInstance.data[key] || defaultData[key]) }];
      normalized = true;
    }
  }
  if (normalized) await dbInstance.write();
  if (!dbInstance.data.migrations?.editableLayout || Object.hasOwn(dbInstance.data, 'navigation')) {
    if (existsSync(dbPath)) await writeFile(`${dbPath}.backup-layout-${Date.now()}`, JSON.stringify(dbInstance.data, null, 2), { flag: 'wx', mode: 0o600 });
    const migrated = structuredClone(dbInstance.data);
    await migrateEditableLayout(migrated);
    dbInstance.data = migrated;
    await dbInstance.write();
  }
  return dbInstance;
}

/**
 * Get database instance
 */
export function getDatabase() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

// Re-export all repositories from their individual files
export { pagesRepo } from './pagesRepository.js';
export { membersRepo } from './membersRepository.js';
export { classesRepo } from './classesRepository.js';
export { movesRepo } from './movesRepository.js';
export { resourcesRepo } from './resourcesRepository.js';
export { siteSettingsRepo } from './siteSettingsRepository.js';
export { usersRepo } from './usersRepository.js';

// Also export the repository classes for testing/extension
export { BaseRepository } from './baseRepository.js';
export { PagesRepository } from './pagesRepository.js';
export { MembersRepository } from './membersRepository.js';
export { ClassesRepository } from './classesRepository.js';
export { MovesRepository } from './movesRepository.js';
export { ResourcesRepository } from './resourcesRepository.js';
export { SiteSettingsRepository } from './siteSettingsRepository.js';
export { UsersRepository } from './usersRepository.js';
export { glossaryRepo, GlossaryRepository } from './glossaryRepository.js';
