import { validateViews } from './views.js';
import { randomUUID, createHash } from 'node:crypto';
import { getDatabase } from '../../models/database.js';
import { assertSafe, normalizeDefinition, systemDefinitions, SYSTEM, validateRecord, SYSTEM_FIELDS } from './schema.js';

export const emptyState = () => ({ definitions: [], records: {}, views: [], history: [] });
export const stateOf = data => data.dynamic || emptyState();
export const definitionsOf = data => [...systemDefinitions(data), ...stateOf(data).definitions];
export const rowsOf = (data, collection) => SYSTEM.includes(collection) ? data[collection] || [] : stateOf(data).records[collection] || [];
export const revisionOf = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
export function validateState(data) {
  const state = stateOf(data);
  assertSafe(state);
  if (!Array.isArray(state.definitions) || !Array.isArray(state.views) || !state.records || typeof state.records !== 'object' || Array.isArray(state.records) || !Array.isArray(state.history)) throw new Error('Invalid dynamic database state.');
  const definitions = state.definitions.map(normalizeDefinition);
  if (new Set(definitions.map(d => d.id)).size !== definitions.length) throw new Error('Duplicate collection identifier.');
  if (Object.keys(state.records).some(id => !definitions.some(d => d.id === id))) throw new Error('Records have no schema.');
  const all = definitionsOf(data);
  for (const def of definitions) {
    const rows = rowsOf(data, def.id);
    if (!Array.isArray(rows) || rows.length > 50000) throw new Error('Invalid record collection.');
    const ids = new Set();
    for (const row of rows) {
      if (!row.id || typeof row.id !== 'string' || ids.has(row.id)) throw new Error('Invalid or duplicate record ID.');
      ids.add(row.id);
      const clean = validateRecord(def, row);
      // Imports must not bypass sanitization; reject unsafe rich text rather than silently changing a backup.
      for (const f of def.fields) if (f.type === 'richtext' && clean[f.name] !== row[f.name]) throw new Error(`Unsafe rich text in ${def.id}.${f.name}`);
    }
    for (const f of def.fields) {
      if (f.type === 'relationship' && !all.some(d => d.id === f.target)) throw new Error(`Missing relationship collection: ${f.target}`);
      const seen = new Set();
      const targetIds = new Set(rowsOf(data, f.target).map(row => row.id));
      for (const row of rows) {
        const value = row[f.name];
        if (value === undefined) continue;
        if (f.unique) { const key = JSON.stringify(value); if (seen.has(key)) throw new Error(`${f.label} must be unique.`); seen.add(key); }
        if (f.type === 'relationship') for (const id of Array.isArray(value) ? value : [value]) {
          if (!targetIds.has(id)) throw new Error(`${f.label}: referenced record does not exist.`);
        }
      }
      if (f.type === 'relationship' && f.cardinality !== 'many-to-many') {
        const owners = new Set();
        for (const row of rows) for (const id of [row[f.name]].flat().filter(Boolean)) {
          if (owners.has(id)) throw new Error(`${f.label}: target already belongs to another record.`);
          owners.add(id);
        }
      }
    }
  }
  validateViews(data);
  return true;
}
export function assertNotReferenced(data, collection, id) {
  for (const def of stateOf(data).definitions) for (const f of def.fields) {
    if (f.type !== 'relationship' || f.target !== collection) continue;
    if (rowsOf(data, def.id).some(row => [row[f.name]].flat().includes(id))) throw new Error(`Record is referenced by ${def.label}.${f.label}. Remove the relationship first.`);
  }
}
// Adapter boundary: mutations work on an isolated candidate and publish only after a successful write.
export class LowCollectionAdapter {
  read() { return getDatabase().data; }
  async commit(candidate) {
    const db = getDatabase(), previous = db.data;
    db.data = candidate;
    try { await db.write(); } catch (error) { db.data = previous; throw error; }
  }
}
export class CollectionStore {
  constructor(adapter = new LowCollectionAdapter()) { this.adapter = adapter; this.queue = Promise.resolve(); }
  data() { return this.adapter.read(); }
  definitions() { return definitionsOf(this.data()); }
  definition(id) { const def = this.definitions().find(d => d.id === id); if (!def) throw new Error('Collection not found.'); return def; }
  rows(id) { this.definition(id); return structuredClone(rowsOf(this.data(), id)); }
  async mutate(change) {
    const run = this.queue.then(async () => {
      const candidate = structuredClone(this.data());
      candidate.dynamic ||= emptyState();
      const result = await change(candidate);
      validateState(candidate);
      await this.adapter.commit(candidate);
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
  preview(input) {
    const definition = normalizeDefinition(input), data = this.data(), candidate = structuredClone(data);
    candidate.dynamic ||= emptyState();
    const previous = candidate.dynamic.definitions.find(d => d.id === definition.id);
    const errors = [];
    if (previous) for (const f of previous.fields) if (!definition.fields.some(n => n.name === f.name) && rowsOf(data, definition.id).some(r => Object.hasOwn(r, f.name))) errors.push(`Cannot remove populated field ${f.name}. Export and migrate records explicitly first.`);
    candidate.dynamic.definitions = candidate.dynamic.definitions.filter(d => d.id !== definition.id).concat(definition);
    candidate.dynamic.records[definition.id] ||= [];
    try { validateState(candidate); } catch (error) { errors.push(error.message); }
    return { definition, revision: revisionOf(data), count: rowsOf(data, definition.id).length, errors };
  }
  async saveDefinition(input, revision) {
    return this.mutate(data => {
      if (revision !== revisionOf(this.data())) throw new Error('Data changed since preview. Preview again before applying.');
      const preview = this.preview(input);
      if (preview.errors.length) throw new Error(preview.errors.join(' '));
      const state = data.dynamic, previous = state.definitions.find(d => d.id === input.id);
      state.history.push({ id: randomUUID(), collection: input.id, definition: previous || null, savedAt: new Date().toISOString() });
      state.history = state.history.slice(-100);
      state.definitions = state.definitions.filter(d => d.id !== input.id).concat(preview.definition);
      state.records[input.id] ||= [];
      return preview.definition;
    });
  }
  async deleteDefinition(id) {
    if (this.definition(id).system) throw new Error('System collections are protected.');
    return this.mutate(data => {
      if (rowsOf(data, id).length) throw new Error('Delete records explicitly before deleting the collection.');
      if (data.dynamic.views.some(v => v.collection === id) || data.dynamic.definitions.some(d => d.fields.some(f => f.target === id))) throw new Error('Collection is referenced by a view or relationship.');
      data.dynamic.definitions = data.dynamic.definitions.filter(d => d.id !== id);
      delete data.dynamic.records[id];
    });
  }
  async saveRecord(collection, input, id) {
    const def = this.definition(collection);
    if (def.system) throw new Error('Use the existing system collection editor.');
    return this.mutate(data => {
      assertSafe(input);
      if (SYSTEM_FIELDS.some(k => Object.hasOwn(input, k))) throw new Error('System fields cannot be edited.');
      const rows = data.dynamic.records[collection];
      const old = id ? rows.find(r => r.id === id) : null;
      if (id && !old) throw new Error('Record not found.');
      const record = validateRecord(def, { ...old, ...input, id: id || randomUUID(), createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
      if (old) rows.splice(rows.indexOf(old), 1, record); else rows.push(record);
      return record;
    });
  }
  async deleteRecord(collection, id) {
    if (this.definition(collection).system) throw new Error('Use the existing system collection editor.');
    return this.mutate(data => {
      assertNotReferenced(data, collection, id);
      data.dynamic.records[collection] = rowsOf(data, collection).filter(r => r.id !== id);
    });
  }
}
export const collectionStore = new CollectionStore();
