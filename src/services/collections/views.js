import { assertSafe, identifier } from './schema.js';
import { collectionStore, definitionsOf, rowsOf, stateOf } from './store.js';
export const OPERATORS = ['eq', 'ne', 'contains', 'gt', 'gte', 'lt', 'lte', 'in', 'exists'];
const privateCollections = ['users', 'siteSettings'];
function fieldInfo(data, collection, path) {
  if (typeof path !== 'string') throw new Error('Choose a field.');
  const parts = path.split('.');
  if (parts.length > 2) throw new Error('Only one relationship hop is supported.');
  parts.forEach(identifier);
  const definition = definitionsOf(data).find(d => d.id === collection);
  if (!definition || privateCollections.includes(collection)) throw new Error('Collection is unavailable for views.');
  const field = definition.fields.find(f => f.name === parts[0]);
  if (!field && !['id', 'createdAt', 'updatedAt'].includes(path)) throw new Error(`Unknown field: ${path}`);
  if (parts.length === 2) {
    if (field?.type !== 'relationship') throw new Error('Relationship field required.');
    fieldInfo(data, field.target, parts[1]);
  }
  return { field, parts };
}
export function normalizeView(data, input) {
  assertSafe(input);
  const id = identifier(input.id);
  if (!input.name?.trim() || input.name.length > 120) throw new Error('Enter a view name.');
  const def = definitionsOf(data).find(d => d.id === input.collection);
  if (!def || privateCollections.includes(def.id)) throw new Error('Choose a public content collection.');
  const fields = input.fields || def.fields.slice(0, 4).map(f => f.name);
  if (!Array.isArray(fields) || !fields.length || fields.length > 100) throw new Error('Select output fields.');
  fields.forEach(field => fieldInfo(data, def.id, field));
  const parameters = input.parameters || [];
  if (!Array.isArray(parameters) || parameters.length > 20) throw new Error('Invalid parameters.');
  for (const param of parameters) {
    identifier(param.name);
    if (!['string', 'number', 'boolean', 'date'].includes(param.type)) throw new Error('Invalid parameter type.');
  }
  if (new Set(parameters.map(p => p.name)).size !== parameters.length) throw new Error('Duplicate parameter.');
  let count = 0;
  function filter(node, depth = 0) {
    if (++count > 100 || depth > 5) throw new Error('Too many filter conditions.');
    if (node.conditions) {
      if (!['and', 'or'].includes(node.logic) || !Array.isArray(node.conditions)) throw new Error('Use AND or OR conditions.');
      return { logic: node.logic, conditions: node.conditions.map(n => filter(n, depth + 1)) };
    }
    fieldInfo(data, def.id, node.field);
    if (!OPERATORS.includes(node.operator)) throw new Error('Unsupported query operator.');
    if (node.parameter && !parameters.some(p => p.name === node.parameter)) throw new Error('Unknown query parameter.');
    if (node.relative && node.relative !== 'today') throw new Error('Unknown relative date.');
    return { field: node.field, operator: node.operator, ...(node.parameter ? { parameter: node.parameter } : node.relative ? { relative: node.relative } : { value: node.value ?? null }) };
  }
  const filters = filter(input.filters || { logic: 'and', conditions: [] });
  const sort = input.sort || [];
  if (!Array.isArray(sort) || sort.length > 5) throw new Error('Use at most five sort fields.');
  for (const item of sort) { fieldInfo(data, def.id, item.field); if (!['asc', 'desc'].includes(item.direction)) throw new Error('Invalid sort direction.'); }
  const pageSize = Number(input.pageSize ?? 12);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Page size must be 1–100.');
  return { id, name: input.name.trim(), collection: def.id, fields, filters, sort, parameters, pageSize, public: input.public === true };
}
function values(data, collection, row, path) {
  const { field, parts } = fieldInfo(data, collection, path);
  if (parts.length === 1) return [row[parts[0]]];
  const ids = [row[parts[0]]].flat();
  return rowsOf(data, field.target).filter(r => ids.includes(r.id)).map(r => r[parts[1]]);
}
function compare(value, operator, expected) {
  switch (operator) {
    case 'eq': return value === expected;
    case 'ne': return value !== expected;
    case 'exists': return (value !== undefined && value !== null && value !== '') === Boolean(expected);
    case 'contains': return Array.isArray(value) ? value.includes(expected) : typeof value === 'string' && value.toLowerCase().includes(String(expected).toLowerCase());
    case 'in': return Array.isArray(expected) && expected.includes(value);
    case 'gt': return value != null && value > expected;
    case 'gte': return value != null && value >= expected;
    case 'lt': return value != null && value < expected;
    case 'lte': return value != null && value <= expected;
    default: return false;
  }
}
export function queryView(data, input, query = {}, { publicOnly = false, all = false } = {}) {
  assertSafe(query);
  const view = normalizeView(data, input);
  if (publicOnly && !view.public) throw new Error('View is not public.');
  const parameters = {};
  for (const p of view.parameters) {
    let value = query[p.name] ?? p.default;
    if (value === undefined || value === '') { if (p.required) throw new Error(`Missing parameter: ${p.name}`); continue; }
    if (p.type === 'number') { value = Number(value); if (!Number.isFinite(value)) throw new Error(`Invalid parameter: ${p.name}`); }
    else if (p.type === 'boolean') { if (![true, false, 'true', 'false'].includes(value)) throw new Error(`Invalid parameter: ${p.name}`); value = value === true || value === 'true'; }
    else { if (typeof value !== 'string' || value.length > 1000) throw new Error(`Invalid parameter: ${p.name}`); if (p.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date parameter: ${p.name}`); }
    parameters[p.name] = value;
  }
  function matches(row, node) {
    if (node.conditions) return node.logic === 'and' ? node.conditions.every(n => matches(row, n)) : node.conditions.length === 0 || node.conditions.some(n => matches(row, n));
    if (node.parameter && parameters[node.parameter] === undefined) return true;
    const expected = node.parameter ? parameters[node.parameter] : node.relative ? new Date().toISOString().slice(0, 10) : node.value;
    return values(data, view.collection, row, node.field).some(v => compare(v, node.operator, expected));
  }
  let rows = rowsOf(data, view.collection).filter(row => (!publicOnly || view.collection !== 'pages' || row.published === true) && matches(row, view.filters));
  if (query.q) {
    if (typeof query.q !== 'string' || query.q.length > 200) throw new Error('Invalid search.');
    rows = rows.filter(row => view.fields.some(field => values(data, view.collection, row, field).some(v => String(v ?? '').toLowerCase().includes(query.q.toLowerCase()))));
  }
  let sort = view.sort;
  if (query.sort) {
    if (!view.fields.includes(query.sort) || !['asc', 'desc', undefined].includes(query.direction)) throw new Error('Invalid sort field or direction.');
    sort = [{ field: query.sort, direction: query.direction || 'asc' }];
  }
  rows.sort((a, b) => {
    for (const item of sort) {
      const av = values(data, view.collection, a, item.field)[0], bv = values(data, view.collection, b, item.field)[0];
      const comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), 'en', { numeric: true });
      if (comparison) return comparison * (item.direction === 'desc' ? -1 : 1);
    }
    return String(a.id).localeCompare(String(b.id));
  });
  const page = Number(query.page || 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000000) throw new Error('Invalid page number.');
  const total = rows.length;
  if (query.record) rows = rows.filter(row => row.id === query.record);
  if (!all) rows = rows.slice((page - 1) * view.pageSize, page * view.pageSize);
  const records = rows.map(row => Object.fromEntries([['id', row.id], ...view.fields.map(f => [f, values(data, view.collection, row, f).length === 1 ? values(data, view.collection, row, f)[0] : values(data, view.collection, row, f)])]));
  return { records, total, page, pageSize: view.pageSize, pages: Math.ceil(total / view.pageSize), view };
}
export function validateViews(data) {
  const views = stateOf(data).views;
  const ids = new Set();
  for (const view of views) { normalizeView(data, view); if (ids.has(view.id)) throw new Error('Duplicate view identifier.'); ids.add(view.id); }
}
export const viewService = {
  list: () => structuredClone(stateOf(collectionStore.data()).views),
  async save(input) {
    return collectionStore.mutate(data => {
      const view = normalizeView(data, input);
      data.dynamic.views = data.dynamic.views.filter(v => v.id !== view.id).concat(view);
      return view;
    });
  },
  async delete(id) {
    return collectionStore.mutate(data => {
      if ((data.pages || []).some(p => p.dataSources?.includes(`view:${id}`) || p.dataView?.id === id)) throw new Error('View is bound to a page. Remove the binding first.');
      data.dynamic.views = data.dynamic.views.filter(v => v.id !== id);
    });
  },
  run(id, query, options) {
    const view = this.list().find(v => v.id === id);
    if (!view) throw new Error('Data view not found.');
    return queryView(collectionStore.data(), view, query, options);
  },
};
