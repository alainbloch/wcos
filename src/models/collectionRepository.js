import { collectionStore } from "../services/collections/store.js";
/** One repository implementation for every content collection. Instances only carry a collection identifier. */
export class CollectionRepository {
  constructor(collectionName, store) {
    this.collectionName = collectionName;
    this.adapterStore = store;
  }
  get store() {
    return this.adapterStore || collectionStore;
  }
  get collection() {
    return this.store.rows(this.collectionName);
  }
  async findAll() {
    return this.collection;
  }
  async findById(id) {
    return this.collection.find((row) => row.id === id) || null;
  }
  async findMany(query) {
    return this.collection.filter((row) =>
      Object.entries(query).every(([key, value]) => row[key] === value),
    );
  }
  async findOne(query) {
    return (await this.findMany(query))[0] || null;
  }
  // Generic convenience selectors retained for callers during the migration.
  async findBySlug(slug) {
    return this.findOne({ slug });
  }
  async findPublished() {
    return this.findMany({ published: true });
  }
  async findActive() {
    return this.findMany({ active: true });
  }
  async findByLevel(level) {
    return this.findMany({ level });
  }
  async findByRegion(region) {
    return this.findMany({ region });
  }
  async create(record) {
    return this.store.saveRecord(
      this.collectionName,
      record,
      undefined,
      false,
      { internal: true },
    );
  }
  async update(id, record) {
    if (!(await this.findById(id))) return null;
    return this.store.saveRecord(this.collectionName, record, id, false, {
      internal: true,
    });
  }
  async delete(id) {
    return this.store.deleteRecord(this.collectionName, id);
  }
  async reorder(ids, field = "order") {
    return this.store.reorder(this.collectionName, ids, field);
  }
}
const repositories = new Map();
export function repositoryFor(collection) {
  if (!repositories.has(collection))
    repositories.set(collection, new CollectionRepository(collection));
  return repositories.get(collection);
}
export const pagesRepo = repositoryFor("pages"),
  membersRepo = repositoryFor("members"),
  classesRepo = repositoryFor("classes"),
  movesRepo = repositoryFor("moves"),
  glossaryRepo = repositoryFor("glossary"),
  updatesRepo = repositoryFor("updates");
