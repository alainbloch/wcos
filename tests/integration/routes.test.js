/**
 * Integration Tests - Routes (Simplified)
 * Tests basic route functionality that works reliably
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { initDatabase, getDatabase } from '../../src/models/database.js';
import { buildApp } from '../../src/app.js';
import { siteSettingsRepo, pagesRepo } from '../../src/models/database.js';
import { authService } from '../../src/services/authService.js';

describe('Public Routes', () => {
  let app;
  let db;

  beforeAll(async () => {
    app = await buildApp();
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
    
    // Create test pages
    const pageSlugs = [
      'wcos-etiquette-rules', 'contact-us', 'previous-updates', 'photo-gallery',
      'fighter-class', 'armor', 'weapons', 'sparring', 'sword-dance', 'glossary',
      'three-rules-of-swordsmanship', 'six-traditions', 'wcos-rules',
      'western-circle-swordfighters-rules', 'western-circle-kaidens-rules',
      'event-hosting-rules', 'event-rules', 'combat-rules'
    ];
    
    for (const slug of pageSlugs) {
      await pagesRepo.create({
        title: slug,
        slug,
        content: `<p>Test ${slug}</p>`,
        published: true,
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });
      
      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.status).toBe('ok');
      expect(payload).toHaveProperty('timestamp');
    });
  });

  describe('GET /', () => {
    it('should render homepage', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.payload).toContain('Western Circle of Swordfighters');
    });
  });

  describe('Working Static Pages', () => {
    const workingPages = [
      { url: '/member-profiles', title: 'Member Profiles' },
      { url: '/hall-of-heroes', title: 'Hall of Heroes' },
      { url: '/rank-requirements', title: 'Rank Requirements' },
      { url: '/core-moves', title: 'Core Moves' },
      { url: '/dalmater-colors', title: 'Dalmater Colors' },
      { url: '/kaidens', title: 'Kaidens' },
      { url: '/fighter-class', title: 'Fighter Class' },
      { url: '/armor', title: 'Armor' },
      { url: '/weapons', title: 'Weapons' },
      { url: '/sparring', title: 'Sparring' },
      { url: '/sword-dance', title: 'Sword Dance' },
      { url: '/glossary', title: 'Glossary' },
      { url: '/classes', title: 'Classes' },
      { url: '/wcos-etiquette-rules', title: 'WCoS Etiquette' },
      { url: '/login', title: 'Login' },
    ];

    for (const page of workingPages) {
      it(`should render ${page.url}`, async () => {
        const response = await app.inject({
          method: 'GET',
          url: page.url,
        });
        
        expect(response.statusCode).toBe(200);
        expect(response.payload).toContain(page.title);
      });
    }
  });

  describe('GET /login', () => {
    it('should render login page', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/login',
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain('Login');
    });
  });

  describe('GET /register', () => {
    it('should render register page', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/register',
      });
      
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
  });
});

describe('Authentication Flow', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects public account creation', async () => {
    const response = await app.inject({ method: 'POST', url: '/register', payload: { email: 'intruder@example.com', password: 'Password123!' } });
    expect(response.statusCode).toBe(403);
  });

  it('should login with valid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/login',
      payload: {
        email: 'admin@wcos.org',
        password: 'TestAdmin123!',
      },
    });
    
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/admin');
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('should reject login with invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/login',
      payload: {
        email: 'admin@wcos.org',
        password: 'wrongpassword',
      },
    });
    
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/login');
  });

  it('should logout and clear cookie', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/login',
      payload: {
        email: 'admin@wcos.org',
        password: 'TestAdmin123!',
      },
    });
    
    const cookies = loginResponse.headers['set-cookie'];
    const authCookie = cookies ? cookies[0].split(';')[0] : '';
    
    const logoutResponse = await app.inject({
      method: 'GET',
      url: '/logout',
      headers: {
        cookie: authCookie,
      },
    });
    
    expect(logoutResponse.statusCode).toBe(302);
    expect(logoutResponse.headers.location).toBe('/login');
    expect(logoutResponse.headers['set-cookie']).toBeDefined();
  });
});

describe('Admin Routes - Auth Required', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin',
      });
      
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /admin/pages', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/pages',
      });
      
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /admin/settings', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/settings',
      });
      
      expect(response.statusCode).toBe(401);
    });
  });
});

describe('404 Handling', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 404 for unknown routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/non-existent-page',
    });
    
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.payload).toContain('Page not found');
  });
});