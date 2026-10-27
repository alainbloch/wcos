import { assertNotReferenced } from '../services/collections/store.js';
/**
 * Base Repository
 * Provides common CRUD operations for all repositories
 */
import { getDatabase } from './database.js';

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
    assertNotReferenced(this.db.data, this.collectionName, id);
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