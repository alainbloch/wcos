import { it, expect } from '@jest/globals';
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import config from '../../src/config/index.js';
import { buildApp } from '../../src/app.js';
import { defaultData, initDatabase, getDatabase } from '../../src/models/database.js';

it('preserves content and legacy records across full restarts without migration markers', async () => {
  const fixture = {
    ...structuredClone(defaultData),
    users: [{ id: 'existing-admin', email: 'admin@example.org', password: 'unchanged' }],
    pages: [{ id: 'news', slug: 'news', content: '<div class="jkit-posts">My news</div>' }],
    members: [{ id: 'gad', position: 'Gad', merits: ['Head Kaiden'] }],
    classes: [{ id: 'custom-class', name: 'Custom class' }],
    councilMembers: [{ name: 'Gad', current: true }],
    dalmaterColors: [{ kaiden: 'Head Kaiden Gad', color: 'Jade Green' }],
    coreMoves: [{ id: 'legacy-move', name: 'Legacy move' }],
    champions: [{ name: 'Gad', year: '2000' }],
    navigation: [{ label: 'Custom navigation' }],
  };
  const original = JSON.stringify(fixture);
  await writeFile(config.dbPath, original);
  const filesBefore = await readdir(path.dirname(config.dbPath));
  for (let restart = 0; restart < 2; restart++) {
    const app = await buildApp();
    try {
      expect((await app.inject('/health')).statusCode).toBe(200);
      expect(getDatabase().data).toEqual(fixture);
      expect(await readFile(config.dbPath, 'utf8')).toBe(original);
    } finally { await app.close(); }
  }
  expect(await readdir(path.dirname(config.dbPath))).toEqual(filesBefore);
});

it('does not normalize or rewrite an existing legacy settings object or empty document', async () => {
  for (const fixture of [{ ...structuredClone(defaultData), siteSettings: { siteName: 'Legacy' } }, {}]) {
    const original = JSON.stringify(fixture);
    await writeFile(config.dbPath, original);
    expect((await initDatabase()).data).toEqual(fixture);
    expect(await readFile(config.dbPath, 'utf8')).toBe(original);
  }
});

it('initializes a missing file with the current empty schema and independent defaults', async () => {
  await rm(config.dbPath);
  const db = await initDatabase();
  expect(JSON.parse(await readFile(config.dbPath, 'utf8'))).toEqual(defaultData);
  expect(db.data.pages).toEqual([]);
  expect(db.data.updates).toEqual([]);
  expect(db.data.glossary).toEqual([]);
  expect(Array.isArray(db.data.siteSettings)).toBe(true);
  db.data.pages.push({ id: 'temporary' });
  expect(defaultData.pages).toEqual([]);
});
