import { validateSystemRecord } from "../services/collections/schema.js";
import { assertNotReferenced } from "../services/collections/store.js";
import { BaseRepository } from "./baseRepository.js";
export class GlossaryRepository extends BaseRepository {
  constructor() {
    super("glossary");
  }
  async findAll() {
    return [...(this.collection || [])].sort((a, b) =>
      a.name.localeCompare(b.name, "en", {
        sensitivity: "base",
        numeric: true,
      }),
    );
  }
  async commit(records) {
    const previous = this.db.data.glossary;
    this.db.data.glossary = records;
    try {
      await this.db.write();
    } catch (error) {
      this.db.data.glossary = previous;
      throw error;
    }
  }
  async create(data) {
    validateSystemRecord(this.collectionName, data);
    const record = {
      ...data,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };
    await this.commit([...(this.collection || []), record]);
    return record;
  }
  async update(id, data) {
    validateSystemRecord(this.collectionName, data);
    const current = await this.findById(id);
    if (!current) throw new Error("Glossary item not found");
    const record = {
      ...current,
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    };
    await this.commit(
      this.collection.map((item) => (item.id === id ? record : item)),
    );
    return record;
  }
  async delete(id) {
    assertNotReferenced(this.db.data, this.collectionName, id);
    if (!(await this.findById(id))) throw new Error("Glossary item not found");
    await this.commit(this.collection.filter((item) => item.id !== id));
    return true;
  }
}
export const glossaryRepo = new GlossaryRepository();
