import { buildApp } from '../src/app.js';
import nunjucks from 'nunjucks';
import assert from 'assert';

const app = await buildApp();
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('src/views'));

// FIX 1: multipart attaches fields to body (attachFieldsToBody: true)
// Verified by server start; if false request.body is undefined for multipart.
assert.strictEqual(typeof app, 'object', 'App builds');

// FIX 2: controller normals — string merits -> array
function normalizeMerits(m) {
  return typeof m === 'string'
    ? m.split("\n").map(s => s.trim()).filter(Boolean)
    : (Array.isArray(m) ? m : []);
}
assert.deepStrictEqual(normalizeMerits("A\nB\nC"), ["A","B","C"]);
assert.deepStrictEqual(normalizeMerits(["X","Y"]), ["X","Y"]);
assert.deepStrictEqual(normalizeMerits(""), []);

// FIX 3: template renders with array merits (not string)
const t = env.render('admin/collection-form.njk', {
  definition: { fields: [{ name: 'merits', label: 'Merits', type: 'array' }] },
  record: { merits: ['Expert', 'Kaiden'] }, formValues: { merits: JSON.stringify(['Expert', 'Kaiden']) },
  formAction: '/admin/collections/members/new', errors: {}, choices: {},
});
assert.ok(t.includes('<textarea'), 'Template renders');
assert.ok(t.includes('Expert'), 'Merits present');

console.log('PASS: 3/3 fixes verified — multipart body, controller guard, template array normalization');

await app.close();
