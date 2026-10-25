import { ensureReferencePages } from "../../src/services/referenceSiteService.js";
/**
 * Integration Tests - Template Syntax
 * Tests that all templates render without syntax errors
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { initDatabase, getDatabase } from '../../src/models/database.js';
import { buildApp } from '../../src/app.js';
import { siteSettingsRepo, pagesRepo } from '../../src/models/database.js';
import { authService } from '../../src/services/authService.js';

describe('Template Syntax Tests', () => {
  let app;
  let db;

  beforeAll(async () => {
    app = await buildApp();
  await ensureReferencePages();
    await app.ready();
    db = getDatabase();
    
    // Seed base data
    await siteSettingsRepo.create({
      siteName: 'Western Circle of Swordfighters',
      siteEmail: 'westerncouncil@gmail.com',
      heroTitle: 'WESTERN CIRCLE OF SWORDFIGHTERS',
      heroSubtitle: 'experts',
      dojosText: 'DOJOS IN CA, OR, WA, NV AND KY',
    });
    

    
    // Create admin user
    await authService.initializeAdmin();
    
    // Create test pages including ones with complex logic
    await pagesRepo.create({
      title: 'WCOS Council',
      slug: 'wcos-council',
      content: '<p>Test council page</p>',
      published: true,
    });
    

  });

  afterAll(async () => {
    await app.close();
  });

  describe('Pages with complex template logic', () => {
    it('should render wcos-council with historical dates', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/wcos-council',
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain('WCOS Council');
      expect(response.payload).toContain('July 23, 2005');
    });

    it('should render kaidens with rules accordion', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/kaidens',
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain('Kaidens');
    });

    it('should render core-moves with category accordions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/core-moves',
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain('Core Moves');
    });

    it('should render rank-requirements with accordion', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/rank-requirements',
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain('Rank Requirements');
    });

    it('should render dalmater-colors with red dalmater section', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dalmater-colors',
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain('Dalmater Colors');
    });

    it('should render links-resources with category accordions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/links-resources',
      });
      
      expect(response.statusCode).toBe(200);
      // HTML escapes & to & in the page title
      expect(response.payload).toContain('Links &amp; Resources');
    });

    it('should render etiquette-rules with sub-rules accordion', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/wcos-etiquette-rules',
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain('WCoS Etiquette');
    });

    it('should render classes with region grouping', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/classes',
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain('Classes');
    });
  });
});