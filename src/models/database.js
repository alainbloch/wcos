/**
 * Database Service
 * Lowdb JSON file database with repository pattern
 */
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default schema
const defaultData = {
  pages: [],
  members: [],
  champions: [],
  councilMembers: [],
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

/**
 * Generic Repository Base Class
 * Provides common CRUD operations
 */
export class BaseRepository {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  get db() {
    return getDatabase();
  }

  get collection() {
    return this.db.data[this.collectionName];
  }

  async findAll() {
    return this.collection || [];
  }

  async findById(id) {
    return this.collection?.find((item) => item.id === id) || null;
  }

  async findOne(query) {
    return this.collection?.find((item) => {
      return Object.entries(query).every(([key, value]) => item[key] === value);
    }) || null;
  }

  async findMany(query) {
    if (!this.collection) return [];
    return this.collection.filter((item) => {
      return Object.entries(query).every(([key, value]) => item[key] === value);
    });
  }

  async create(data) {
    const newItem = {
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    this.collection.push(newItem);
    await this.db.write();
    return newItem;
  }

  async update(id, data) {
    const index = this.collection?.findIndex((item) => item.id === id);
    if (index === undefined || index === -1) return null;

    this.collection[index] = {
      ...this.collection[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await this.db.write();
    return this.collection[index];
  }

  async delete(id) {
    const index = this.collection?.findIndex((item) => item.id === id);
    if (index === undefined || index === -1) return false;

    this.collection.splice(index, 1);
    await this.db.write();
    return true;
  }

  generateId() {
    return `${this.collectionName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export specific repositories
export class PagesRepository extends BaseRepository {
  constructor() {
    super('pages');
  }

  async findBySlug(slug) {
    return this.findOne({ slug });
  }

  async findPublished() {
    return this.findMany({ published: true });
  }
}

export class MembersRepository extends BaseRepository {
  constructor() {
    super('members');
  }

  async findByLevel(level) {
    return this.findMany({ level });
  }

  async findActive() {
    return this.findMany({ active: true });
  }

  async findByRegion(region) {
    return this.findMany({ region });
  }
}

export class ChampionsRepository extends BaseRepository {
  constructor() {
    super('champions');
  }

  async findByYear(year) {
    return this.findOne({ year });
  }

  async findAllSorted() {
    const champions = await this.findAll();
    return champions.sort((a, b) => b.year - a.year);
  }
}

export class CouncilMembersRepository extends BaseRepository {
  constructor() {
    super('councilMembers');
  }

  async findCurrent() {
    return this.findMany({ current: true });
  }
}

export class ClassesRepository extends BaseRepository {
  constructor() {
    super('classes');
  }

  async findActive() {
    return this.findMany({ active: true });
  }
}

export class RanksRepository extends BaseRepository {
  constructor() {
    super('ranks');
  }

  async findByType(type) {
    return this.findMany({ type });
  }

  async findByLevel(level) {
    return this.findOne({ level });
  }
}

export class CoreMovesRepository extends BaseRepository {
  constructor() {
    super('coreMoves');
  }

  async findByCategory(category) {
    return this.findMany({ category });
  }
}

export class DalmaterColorsRepository extends BaseRepository {
  constructor() {
    super('dalmaterColors');
  }

  async findByKaiden(kaiden) {
    return this.findOne({ kaiden });
  }
}

export class KaidensRepository extends BaseRepository {
  constructor() {
    super('kaidens');
  }
}

export class KaidenRulesRepository extends BaseRepository {
  constructor() {
    super('kaidenRules');
  }

  async findOrdered() {
    const rules = await this.findAll();
    return rules.sort((a, b) => a.order - b.order);
  }
}

export class ResourcesRepository extends BaseRepository {
  constructor() {
    super('resources');
  }

  async findByCategory(category) {
    return this.findMany({ category });
  }
}

export class DuesRepository extends BaseRepository {
  constructor() {
    super('dues');
  }

  async findActive() {
    return this.findMany({ active: true });
  }
}

export class SiteSettingsRepository extends BaseRepository {
  constructor() {
    super('siteSettings');
  }

  async getSettings() {
    const settings = await this.findAll();
    return settings[0] || defaultData.siteSettings;
  }

  async updateSettings(data) {
    const settings = await this.getSettings();
    return this.update(settings.id, data);
  }
}

export class NavigationRepository extends BaseRepository {
  constructor() {
    super('navigation');
  }

  async getNavigation() {
    const nav = await this.findAll();
    return nav[0] || defaultData.navigation;
  }

  async updateNavigation(data) {
    const nav = await this.getNavigation();
    return this.update(nav.id, data);
  }
}

export class UsersRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  async findByEmail(email) {
    return this.findOne({ email });
  }

  async findByUsername(username) {
    return this.findOne({ username });
  }
}

// Singleton instances
export const pagesRepo = new PagesRepository();
export const membersRepo = new MembersRepository();
export const championsRepo = new ChampionsRepository();
export const councilMembersRepo = new CouncilMembersRepository();
export const classesRepo = new ClassesRepository();
export const ranksRepo = new RanksRepository();
export const coreMovesRepo = new CoreMovesRepository();
export const dalmaterColorsRepo = new DalmaterColorsRepository();
export const kaidensRepo = new KaidensRepository();
export const kaidenRulesRepo = new KaidenRulesRepository();
export const resourcesRepo = new ResourcesRepository();
export const duesRepo = new DuesRepository();
export const siteSettingsRepo = new SiteSettingsRepository();
export const navigationRepo = new NavigationRepository();
export const usersRepo = new UsersRepository();