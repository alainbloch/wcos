/**
 * Database Service
 * Lowdb JSON file database with repository pattern
 */
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { mkdir, writeFile } from 'node:fs/promises';
import { mergeCouncilMembers } from './migrations/mergeCouncilMembers.js';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default schema
export const defaultData = {
  pages: [],
  members: [],
  champions: [],
  classes: [],
  ranks: [],
  coreMoves: [],
  dalmaterColors: [],
  kaidens: [],
  kaidenRules: [],
  resources: [],
  dues: [],
  siteSettings: {
    siteName: 'Western Circle of Swordfighters',
    siteEmail: 'westerncouncil@gmail.com',
    heroTitle: 'WESTERN CIRCLE OF SWORDFIGHTERS',
    heroSubtitle: 'experts',
    dojosText: 'DOJOS IN CA, OR, WA, NV AND KY',
  },
  navigation: {
    whoWeAre: [
      { label: 'Member Profiles', slug: 'member-profiles' },
      { label: 'Photo Gallery', slug: 'photo-gallery' },
      { label: 'WCOS Council', slug: 'wcos-council' },
      { label: 'Hall of Heroes', slug: 'hall-of-heroes' },
    ],
    knowledgeBase: [
      { label: 'Rank Requirements', slug: 'rank-requirements' },
      { label: 'Core Moves', slug: 'core-moves' },
      { label: 'Dalmater Colors', slug: 'dalmater-colors' },
      { label: 'Kaidens', slug: 'kaidens' },
      { label: 'Fighter Class', slug: 'fighter-class' },
      { label: 'Armor', slug: 'armor' },
      { label: 'Weapons', slug: 'weapons' },
      { label: 'Sparring', slug: 'sparring' },
      { label: 'Sword Dance', slug: 'sword-dance' },
      { label: 'Glossary', slug: 'glossary' },
    ],
    involvement: [
      { label: 'Classes', slug: 'classes' },
      { label: 'WCOS Etiquette & Rules', slug: 'wcos-etiquette-rules' },
      { label: 'Dues/Donations', slug: 'dues' },
    ],
    resources: [
      { label: 'Links & Resources', slug: 'links-resources' },
      { label: 'Contact Us', slug: 'contact-us' },
      { label: 'Previous Updates', slug: 'previous-updates' },
    ],
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

  // Earlier versions seeded these two collections as objects even though their
  // repositories use array operations. Normalize once without discarding values.
  let normalized = false;
  for (const key of ['siteSettings', 'navigation']) {
    if (!Array.isArray(dbInstance.data[key])) {
      dbInstance.data[key] = [{ id: key, ...(dbInstance.data[key] || defaultData[key]) }];
      normalized = true;
    }
  }
  if (normalized) await dbInstance.write();
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
export { championsRepo } from './championsRepository.js';
export { classesRepo } from './classesRepository.js';
export { ranksRepo } from './ranksRepository.js';
export { coreMovesRepo } from './coreMovesRepository.js';
export { dalmaterColorsRepo } from './dalmaterColorsRepository.js';
export { kaidensRepo } from './kaidensRepository.js';
export { kaidenRulesRepo } from './kaidenRulesRepository.js';
export { resourcesRepo } from './resourcesRepository.js';
export { duesRepo } from './duesRepository.js';
export { siteSettingsRepo } from './siteSettingsRepository.js';
export { navigationRepo } from './navigationRepository.js';
export { usersRepo } from './usersRepository.js';

// Also export the repository classes for testing/extension
export { BaseRepository } from './baseRepository.js';
export { PagesRepository } from './pagesRepository.js';
export { MembersRepository } from './membersRepository.js';
export { ChampionsRepository } from './championsRepository.js';
export { ClassesRepository } from './classesRepository.js';
export { RanksRepository } from './ranksRepository.js';
export { CoreMovesRepository } from './coreMovesRepository.js';
export { DalmaterColorsRepository } from './dalmaterColorsRepository.js';
export { KaidensRepository } from './kaidensRepository.js';
export { KaidenRulesRepository } from './kaidenRulesRepository.js';
export { ResourcesRepository } from './resourcesRepository.js';
export { DuesRepository } from './duesRepository.js';
export { SiteSettingsRepository } from './siteSettingsRepository.js';
export { NavigationRepository } from './navigationRepository.js';
export { UsersRepository } from './usersRepository.js';