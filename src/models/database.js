/** Database connection. Content migrations must be run explicitly, never at startup. */
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import config from '../config/index.js';

// Default schema
export const defaultData = {
  pages: [],
  members: [],
  classes: [],
  glossary: [],
  updates: [],
  moves: [],
  siteSettings: [{
    id: 'siteSettings',
    siteName: 'Western Circle of Swordfighters',
    siteEmail: 'westerncouncil@gmail.com',
    heroTitle: 'WESTERN CIRCLE OF SWORDFIGHTERS',
    heroSubtitle: 'experts',
    dojosText: 'DOJOS IN CA, OR, WA, NV AND KY',
  }],
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

  // Only persist defaults for a missing file. Existing data is loaded verbatim,
  // including empty collections and absent migration markers.
  if (!existsSync(dbPath)) await dbInstance.write();

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
export { siteSettingsRepo } from './siteSettingsRepository.js';
export { usersRepo } from './usersRepository.js';

// Also export the repository classes for testing/extension
export { BaseRepository } from './baseRepository.js';
export { PagesRepository } from './pagesRepository.js';
export { MembersRepository } from './membersRepository.js';
export { ClassesRepository } from './classesRepository.js';
export { MovesRepository } from './movesRepository.js';
export { SiteSettingsRepository } from './siteSettingsRepository.js';
export { UsersRepository } from './usersRepository.js';
export { glossaryRepo, GlossaryRepository } from './glossaryRepository.js';

export { updatesRepo, UpdatesRepository } from './updatesRepository.js';
