import { validateSystemRecord } from "../services/collections/schema.js";
import { assertNotReferenced } from "../services/collections/store.js";
import { BaseRepository } from "./baseRepository.js";
export class MovesRepository extends BaseRepository {
  constructor() {
    super("moves");
  }
  async findAll() {
    return [...(this.collection || [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
  }
  async commit(records) {
    const previous = this.db.data.moves;
    this.db.data.moves = records;
    try {
      await this.db.write();
    } catch (error) {
      this.db.data.moves = previous;
      throw error;
    }
  }
  async create(data) {
    validateSystemRecord(this.collectionName, data);
    const record = {
      ...data,
      id: this.generateId(),
      order: Math.max(-1, ...this.collection.map((m) => m.order ?? 0)) + 1,
    };
    await this.commit([...this.collection, record]);
    return record;
  }
  async update(id, data) {
    validateSystemRecord(this.collectionName, data);
    const current = await this.findById(id);
    if (!current) throw new Error("Move not found");
    const record = { ...current, ...data, id, order: current.order };
    await this.commit(this.collection.map((m) => (m.id === id ? record : m)));
    return record;
  }
  async delete(id) {
    assertNotReferenced(this.db.data, this.collectionName, id);
    if (!(await this.findById(id))) throw new Error("Move not found");
    await this.commit(this.collection.filter((m) => m.id !== id));
    return true;
  }
  async reorder(ids) {
    if (
      !Array.isArray(ids) ||
      ids.length !== this.collection.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !this.collection.some((m) => m.id === id))
    )
      throw new Error("The moves list changed. Reload before reordering.");
    await this.commit(
      ids.map((id, order) => ({
        ...this.collection.find((m) => m.id === id),
        order,
      })),
    );
  }
}
export const movesRepo = new MovesRepository();
