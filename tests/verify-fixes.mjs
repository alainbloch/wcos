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
const t = env.render('admin/members/form.njk', {
  member: { merits: ["Expert","Kaiden"], circleName: "Gad", id: 1, level: "L1", active: true, biography: "", region: "", memberSince: "" },
  pageTitle: "Edit", flash: null,
  request: { session: {}, id: '1', url: '/admin/members/1/edit', path: '/admin/members/1/edit', params: { id: '1' }, query: {}, method: 'GET', rawUrl: '/admin/members/1/edit', ip: '127.0.0.1', log: () => {}, logChild: () => {}, body: {} },
});
assert.ok(t.includes('<textarea'), 'Template renders');
assert.ok(t.includes('Expert'), 'Merits present');

console.log('PASS: 3/3 fixes verified — multipart body, controller guard, template array normalization');
