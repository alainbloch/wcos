import { mergeMemberHonors } from '../src/models/migrations/mergeMemberHonors.js';
import { seedClasses } from './seed-classes.js';
import { seedCoreMoves } from './seed-core-moves.js';
/**
 * Database Seeding Script
 * Populates the database with initial content from the original WCoS site
 */
import { initDatabase, getDatabase } from '../src/models/database.js';
import { pagesRepo, membersRepo, resourcesRepo, siteSettingsRepo, navigationRepo, usersRepo } from '../src/models/database.js';
import { authService } from '../src/services/authService.js';

async function seed() {
  console.log('🌱 Seeding database...');
  
  await initDatabase();
  const db = getDatabase();

  // Clear existing data (optional - comment out to keep existing)
  // db.data.pages = [];
  // db.data.members = [];
  // db.data.classes = [];
  // db.data.moves = [];
  // db.data.resources = [];
  // db.data.siteSettings = [];
  // db.data.navigation = [];

  // Site Settings
  if ((await siteSettingsRepo.findAll()).length === 0) {
    await siteSettingsRepo.create({
      siteName: 'Western Circle of Swordfighters',
      siteEmail: 'westerncouncil@gmail.com',
      heroTitle: 'WESTERN CIRCLE OF SWORDFIGHTERS',
      heroSubtitle: 'experts',
      dojosText: 'DOJOS IN CA, OR, WA, NV AND KY',
    });
    console.log('  ✓ Site settings');
  }

  // Navigation
  if ((await navigationRepo.findAll()).length === 0) {
    await navigationRepo.create({
      whoWeAre: [
        { label: 'Member Profiles', slug: 'member-profiles' },
        { label: 'Photo Gallery', slug: 'photo-gallery' },
        { label: 'WCOS Council', slug: 'wcos-council' },
        { label: 'Hall of Heroes', slug: 'hall-of-heroes' },
      ],
      knowledgeBase: [
        { label: 'Rank Requirements', slug: 'rank-requirements' },
        { label: 'Core Moves', slug: 'core-moves' },
        { label: 'Dalmater Colors', slug: 'dalmater-colors' },
        { label: 'Kaidens', slug: 'kaidens' },
        { label: 'Fighter Class', slug: 'fighter-class' },
        { label: 'Armor', slug: 'armor' },
        { label: 'Weapons', slug: 'weapons' },
        { label: 'Sparring', slug: 'sparring' },
        { label: 'Sword Dance', slug: 'sword-dance' },
        { label: 'Glossary', slug: 'glossary' },
      ],
      involvement: [
        { label: 'Classes', slug: 'classes' },
        { label: 'WCOS Etiquette & Rules', slug: 'wcos-etiquette-rules' },
        { label: 'Dues/Donations', slug: 'dues' },
      ],
      resources: [
        { label: 'Links & Resources', slug: 'links-resources' },
        { label: 'Contact Us', slug: 'contact-us' },
        { label: 'Previous Updates', slug: 'previous-updates' },
      ],
    });
    console.log('  ✓ Navigation');
  }

  // Members (sample from original site)
  if ((await membersRepo.findAll()).length === 0) {
    const members = [
      { level: 'L7', circleName: 'L7 - steel', position: 'Gad', merits: ['Expert Swordsman', 'Head Kaiden'], memberSince: 'Aug 1982', region: 'Hayward, CA', active: true },
      { level: 'L7', circleName: 'L7 - steel', position: 'Joseph', merits: ['Expert Swordsman', 'Kaiden'], memberSince: 'July 1985', region: 'Southern CA', active: false },
      { level: 'L7', circleName: 'L7 - steel', position: 'Steel Wind', merits: ['Expert Swordsman', 'Kaiden', 'Council'], memberSince: '2004', region: 'Escondido, CA', active: true },
      { level: 'L7', circleName: 'L7 - steel', position: 'Vea Ravenstar', merits: ['Expert Swordsman', 'Kaiden', 'Council', 'Webmaster'], memberSince: 'April 2006', region: 'Hayward, CA', active: true },
      { level: 'L6', circleName: 'L4 - steel', position: 'Storm', merits: ['Expert Swordsman', 'Kaiden'], memberSince: 'Oct 1991', region: 'Southern CA', active: false },
      { level: 'L6', circleName: 'L3 - steel', position: 'Bone Finder', merits: ['Expert Swordsman', 'Kaiden'], memberSince: 'June 1996', region: 'Hayward, CA', active: true },
      { level: 'L6', circleName: 'L4 - steel', position: 'Nikon', merits: ['Expert Swordsman', 'Kaiden', 'Medical Officer'], memberSince: 'Aug 1993', region: 'Seattle, WA', active: true },
      { level: 'L6', circleName: 'L4 - steel', position: 'Kris', merits: ['Expert Swordsman', 'Kaiden'], memberSince: 'Spring 1992', region: 'WI', active: false },
      { level: 'L6', circleName: 'L3 - steel', position: 'The Severer', merits: ['Expert Swordsman', 'Kaiden', 'Council'], memberSince: 'Oct 2001', region: 'Seattle, WA', active: true },
      { level: 'L5', circleName: 'L3 - steel', position: 'Hedge', merits: ['Proficient Swordsman', 'Kaiden', 'Medical Officer'], memberSince: 'Jan 1997', region: 'Southern CA', active: false },
      { level: 'L5', circleName: 'L2 - steel', position: 'Eric', merits: ['Proficient Swordsman', 'Kaiden'], memberSince: 'June 1998', region: 'Portola Valley, CA', active: true },
      { level: 'L5', circleName: 'L3 - steel', position: 'Umbra', merits: ['Proficient Swordsman', 'Kaiden', 'Webmaster'], memberSince: 'Feb 2000', region: 'Beaverton, OR', active: true },
      { level: 'L5', circleName: 'L2 - steel', position: 'The Margrave', merits: ['Proficient Swordsman', 'Kaiden'], memberSince: 'Feb 2000', region: 'South Bay Area, CA', active: true },
    ];
    for (const m of members) {
      await membersRepo.create(m);
    }
    console.log('  ✓ Members');
  }

  await seedClasses();
  if (!db.data.migrations?.memberHonors) mergeMemberHonors(db.data);

  // Actual core moves extracted from the supplied page.
  await seedCoreMoves();

  // Resources
  if ((await resourcesRepo.findAll()).length === 0) {
    const resources = [
      { category: 'Bokken / Wasters (Wood Training Weapons)', name: 'Purpleheart Armory', url: 'https://purpleheartarmory.com', description: 'Quality wooden training weapons' },
      { category: 'Bokken / Wasters (Wood Training Weapons)', name: 'Wooden Sword', url: 'https://woodensword.com', description: 'Custom bokken and wasters' },
      { category: 'Steel Weapons (Combat-Grade, Blunt/Rebated)', name: 'Albion Swords', url: 'https://albion-swords.com', description: 'High-quality combat-ready swords' },
      { category: 'Steel Weapons (Combat-Grade, Blunt/Rebated)', name: 'Darkwood Armory', url: 'https://darkwoodarmory.com', description: 'HEMA-focused training weapons' },
      { category: 'Steel Weapons (Cutting-Grade, Sharps)', name: 'Kult of Athena', url: 'https://kultofathena.com', description: 'Sharp swords for cutting' },
      { category: 'Armor', name: 'Armored Encounters', url: 'https://armoredencounters.com', description: 'HEMA protective gear' },
      { category: 'Armor', name: 'HEMA Gear', url: 'https://hemagear.com', description: 'Full protective equipment' },
      { category: 'Materials', name: 'Online Metals', url: 'https://onlinemetals.com', description: 'Steel, aluminum, titanium' },
      { category: 'Other Guilds & Organizations', name: 'HEMA Alliance', url: 'https://hemaalliance.com', description: 'Historical European Martial Arts Alliance' },
      { category: 'Other Guilds & Organizations', name: 'SCA', url: 'https://sca.org', description: 'Society for Creative Anachronism' },
    ];
    for (const r of resources) {
      await resourcesRepo.create(r);
    }
    console.log('  ✓ Resources');
  }

  // Admin user
  if ((await usersRepo.findAll()).length === 0) {
    await authService.initializeAdmin();
    console.log('  ✓ Admin user');
  }

  // Dynamic Pages
  if ((await pagesRepo.findAll()).length === 0) {
    const pages = [
      { title: 'Fighter Class', slug: 'fighter-class', content: '<p>Content coming soon...</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Armor', slug: 'armor', content: '<p>Content coming soon...</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Weapons', slug: 'weapons', content: '<p>Content coming soon...</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Sparring', slug: 'sparring', content: '<p>Content coming soon...</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Sword Dance', slug: 'sword-dance', content: '<p>Content coming soon...</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Glossary', slug: 'glossary', content: '<p>Content coming soon...</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'WCOS Etiquette & Rules', slug: 'wcos-etiquette-rules', content: '<p>Main etiquette and rules page content.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Three Rules of Swordsmanship', slug: 'three-rules-of-swordsmanship', content: '<p>Three Rules content.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Six Traditions', slug: 'six-traditions', content: '<p>Six Traditions content.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'WCoS Rules', slug: 'wcos-rules', content: '<p>WCoS Rules content.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Western Circle Swordfighters Rules', slug: 'western-circle-swordfighters-rules', content: '<p>Western Circle of Swordfighters Rules content.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Western Circle Kaidens Rules', slug: 'western-circle-kaidens-rules', content: '<p>Western Circle Kaidens\' Rules content.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Event Hosting Rules', slug: 'event-hosting-rules', content: '<p>Event Hosting Rules content.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Event Rules', slug: 'event-rules', content: '<p>Event Rules content.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Combat Rules', slug: 'combat-rules', content: '<p>Combat Rules content.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Contact Us', slug: 'contact-us', content: '<p>Contact us page content.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Previous Updates', slug: 'previous-updates', content: '<p>Previous updates and announcements.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Photo Gallery', slug: 'photo-gallery', content: '<p>Photo gallery coming soon.</p>', published: true, dataSources: [], layout: null, parentSlug: null, styleOverrides: null },
    ];
    for (const p of pages) {
      await pagesRepo.create(p);
    }
    console.log('  ✓ Dynamic Pages');
  }

  await db.write();
  console.log('\n✅ Database seeded successfully!');
}

seed().catch(console.error);