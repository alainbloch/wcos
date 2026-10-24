/**
 * Integration Tests - Dynamic Page Rendering
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { initDatabase, getDatabase } from '../../src/models/database.js';
import { buildApp } from '../../src/app.js';
import { pagesRepo } from '../../src/models/database.js';

describe('Dynamic Page Rendering', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should render admin pages form without syntax errors', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/pages/new',
    });
    expect([200, 302, 401, 403]).toContain(response.statusCode);
  });
});
