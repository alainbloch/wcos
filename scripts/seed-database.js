/**
 * Database Seeding Script
 * Populates the database with initial content from the original WCoS site
 */
import { initDatabase, getDatabase } from '../src/models/database.js';
import { pagesRepo, membersRepo, championsRepo, councilMembersRepo, classesRepo, ranksRepo, coreMovesRepo, dalmaterColorsRepo, kaidensRepo, kaidenRulesRepo, resourcesRepo, duesRepo, siteSettingsRepo, navigationRepo, usersRepo } from '../src/models/database.js';
import { authService } from '../src/services/authService.js';

async function seed() {
  console.log('🌱 Seeding database...');
  
  await initDatabase();
  const db = getDatabase();

  // Clear existing data (optional - comment out to keep existing)
  // db.data.pages = [];
  // db.data.members = [];
  // db.data.champions = [];
  // db.data.councilMembers = [];
  // db.data.classes = [];
  // db.data.ranks = [];
  // db.data.coreMoves = [];
  // db.data.dalmaterColors = [];
  // db.data.kaidens = [];
  // db.data.kaidenRules = [];
  // db.data.resources = [];
  // db.data.dues = [];
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

  // Champions
  if ((await championsRepo.findAll()).length === 0) {
    const champions = [
      { year: 2000, name: '"Hairy" Dave', title: '2000 CHAMPION' },
      { year: 2001, name: 'Joseph', title: '2001 CHAMPION' },
      { year: 2002, name: 'Wulfgar', title: '2002 CHAMPION' },
      { year: 2003, name: 'Abrian', title: '2003 CHAMPION' },
      { year: 2004, name: 'Kaiden Nikon', title: '2004 CHAMPION' },
      { year: 2005, name: 'Kaiden Eric', title: '2005 CHAMPION' },
      { year: 2006, name: 'No Champion', title: '2006 CHAMPION' },
      { year: 2007, name: 'Kaiden Charles', title: '2007 CHAMPION' },
      { year: 2008, name: 'Kaiden Brennan', title: '2008 CHAMPION' },
      { year: 2009, name: 'Kaiden Steel Wind', title: '2009 CHAMPION' },
      { year: 2010, name: 'Head Kaiden Gad', title: '2010 CHAMPION (Champions Edition)' },
      { year: 2011, name: 'Kaiden Vea Ravenstar', title: '2011 CHAMPION' },
      { year: 2012, name: 'Head Kaiden Gad', title: '2012 CHAMPION' },
      { year: 2013, name: 'Kaiden Kris', title: '2013 CHAMPION' },
      { year: 2014, name: 'Kaiden Steel Wind', title: '2014 CHAMPION' },
      { year: 2015, name: 'Kaiden Blight', title: '2015 CHAMPION' },
      { year: 2016, name: 'Master Gemini', title: '2016 CHAMPION' },
      { year: 2017, name: 'The Protector', title: '2017 CHAMPION' },
      { year: 2018, name: 'Kaiden Nikon', title: '2018 CHAMPION' },
      { year: 2019, name: 'Head Kaiden Gad', title: '2019 CHAMPION' },
      { year: 2021, name: 'Master Gemini', title: '2021 CHAMPION' },
    ];
    for (const c of champions) {
      await championsRepo.create(c);
    }
    console.log('  ✓ Champions');
  }

  // Council Members
  if ((await councilMembersRepo.findAll()).length === 0) {
    const council = [
      { name: 'Kaiden Steel Wind', title: 'Kaiden', current: true, image: null, historicalDate: null },
      { name: 'Kaiden Ravenstar', title: 'Kaiden', current: true, image: null, historicalDate: null },
      { name: 'Kaiden Severer', title: 'Kaiden', current: true, image: null, historicalDate: null },
    ];
    for (const c of council) {
      await councilMembersRepo.create(c);
    }
    // Historical dates
    const historical = [
      { name: 'Council Formation', title: 'October 19, 2022', current: false, historicalDate: '2022-10-19' },
      { name: 'Council Formation', title: 'August 31, 2021', current: false, historicalDate: '2021-08-31' },
      { name: 'Council Formation', title: 'September 30, 2017', current: false, historicalDate: '2017-09-30' },
      { name: 'Council Formation', title: 'September 26, 2015', current: false, historicalDate: '2015-09-26' },
      { name: 'Council Formation', title: 'October 6, 2007', current: false, historicalDate: '2007-10-06' },
      { name: 'Council Formation', title: 'April 1, 2006', current: false, historicalDate: '2006-04-01' },
      { name: 'Council Formation', title: 'July 23, 2005', current: false, historicalDate: '2005-07-23' },
    ];
    for (const h of historical) {
      await councilMembersRepo.create(h);
    }
    console.log('  ✓ Council Members');
  }

  // Classes
  if ((await classesRepo.findAll()).length === 0) {
    const classes = [
      { location: 'Hayward, CA', day: 'Tuesday, 7:30PM to 9:30PM', kaiden: 'Kaiden GAD, Kaiden Vea', description: 'WCoS Headquarters Dojo - WCoS Requirements, Way of the Ever Adapting Blade, Steel Combat, NSC, and specialized training', region: 'CA', active: true },
      { location: 'Redding, CA', day: 'Wednesday, 7:30PM to 9:30PM', kaiden: 'Kaiden Requiem, Honorary Kaiden Dalton', description: 'Requirements, Sparring and Drills', region: 'CA', active: true },
      { location: 'Escondido, CA', day: 'Contact for details', kaiden: 'Kaiden Steel Wind', description: 'Requirements, Sparring, Specialized Training, NSC', region: 'CA', active: true },
      { location: 'Louisville, KY', day: 'Sunday, 7:00PM to 9:00PM', kaiden: 'Kaiden Daniel', description: 'WCoS Requirements, Drills, and Sparring', region: 'KY', active: true },
      { location: 'Gardnerville, NV', day: 'Saturday, 9:30AM to 11:30AM', kaiden: 'Kaiden David', description: 'WCoS requirements, stretching/exercises; occasional special trips for specialized training', region: 'NV', active: true },
      { location: 'Beaverton, OR', day: 'Thursday, 7:30PM to 10:00PM', kaiden: 'Kaiden Umbra', description: 'Stretching/Exercises, Requirements, Drills, and Sparring', region: 'OR', active: true },
      { location: 'Seattle, WA', day: 'Monday, 6:00PM to 8:00PM', kaiden: 'Kaiden Severer', description: 'Stretching/Exercises, Requirements, Sparring, Specialized Training', region: 'WA', active: true },
    ];
    for (const c of classes) {
      await classesRepo.create(c);
    }
    console.log('  ✓ Classes');
  }

  // Primary Ranks
  if ((await ranksRepo.findAll()).length === 0) {
    const primaryRanks = [
      { type: 'primary', level: 'Guest', name: 'Guest', description: 'Visitor or new student', requirements: [] },
      { type: 'primary', level: 'L1', name: 'Trainee', description: 'Beginning student learning basics', requirements: ['Attend 4 classes', 'Learn basic safety', 'Learn basic footwork'] },
      { type: 'primary', level: 'L2', name: 'Green Braid - Swordsman', description: 'First ranked level', requirements: ['Complete L1 requirements', 'Pass Green Braid test', 'Demonstrate basic cuts and blocks'] },
      { type: 'primary', level: 'L3', name: 'White Rope - Trained Swordsman', description: 'Intermediate level', requirements: ['Complete L2 requirements', 'Pass White Rope test', 'Demonstrate combinations'] },
      { type: 'primary', level: 'L4', name: 'Red Rope - Skilled Swordsman', description: 'Advanced student', requirements: ['Complete L3 requirements', 'Pass Red Rope test', 'Teach basics to L1-L2 students'] },
      { type: 'primary', level: 'L5', name: 'Crimson Chain - Proficient Swordsman (Red Ring - Sword Dancer)', description: 'Black belt equivalent', requirements: ['Complete L4 requirements', 'Pass Crimson Chain test', 'Demonstrate mastery of core moves', 'Sword Dancer qualification'] },
      { type: 'primary', level: 'L6', name: 'Silver Chain - Advanced Swordsman (Silver Ring - Advanced Sword Dancer)', description: 'Advanced mastery', requirements: ['Complete L5 requirements', 'Pass Silver Chain test', 'Advanced Sword Dancer qualification', 'Teach intermediate students'] },
      { type: 'primary', level: 'L7', name: 'Copper Chain - Expert Swordsman (Copper Ring - Expert Sword Dancer)', description: 'Highest primary rank', requirements: ['Complete L6 requirements', 'Pass Copper Chain test', 'Expert Sword Dancer qualification', 'Teach advanced students'] },
    ];
    for (const r of primaryRanks) {
      await ranksRepo.create(r);
    }

    // Steel Ranks
    const steelRanks = [
      { type: 'steel', level: 'L0', name: 'Live Steel Practitioner', description: 'Introduction to live steel', requirements: ['Complete L5 primary', 'Safety orientation'] },
      { type: 'steel', level: 'L1', name: 'Live Steel Qualified Swordsman', description: 'Basic live steel competency', requirements: ['Pass L0 requirements', 'Demonstrate safe handling'] },
      { type: 'steel', level: 'L2', name: 'Green Braid - Live Steel Ranked Swordsman', description: 'First live steel rank', requirements: ['Complete L1 steel', 'Pass cutting test'] },
      { type: 'steel', level: 'L3', name: 'White Rope - Live Steel Trained Swordsman', description: 'Intermediate live steel', requirements: ['Complete L2 steel', 'Advanced cutting'] },
      { type: 'steel', level: 'L4', name: 'Red Rope - Live Steel Skilled Swordsman', description: 'Advanced live steel', requirements: ['Complete L3 steel', 'Complex cutting patterns'] },
      { type: 'steel', level: 'L5', name: 'Crimson Chain - Live Steel Proficient Swordsman', description: 'Expert live steel', requirements: ['Complete L4 steel', 'Master cutting forms'] },
      { type: 'steel', level: 'L6', name: 'Silver Chain - Live Steel Advanced Swordsman', description: 'Master live steel', requirements: ['Complete L5 steel', 'Teach live steel'] },
      { type: 'steel', level: 'L7', name: 'Copper Chain - Live Steel Expert Swordsman', description: 'Grandmaster live steel', requirements: ['Complete L6 steel', 'Teach all levels'] },
    ];
    for (const r of steelRanks) {
      await ranksRepo.create(r);
    }
    console.log('  ✓ Ranks (Primary + Steel)');
  }

  // Core Moves (sample categories)
  if ((await coreMovesRepo.findAll()).length === 0) {
    const moveTypes = [
      { category: 'Initiated Response', name: 'Initiated Response', description: 'An Offensive attack that creates an opening in which you take advantage of.' },
      { category: 'Straight Offense', name: 'Straight Offense', description: 'A single attack to a predetermined target that is usually left open.' },
      { category: 'Offensive Defense', name: 'Offensive Defense', description: 'An initial defensive action that directly leads to an offensive attack.' },
    ];
    for (const m of moveTypes) {
      await coreMovesRepo.create(m);
    }

    const coreMoves = [
      { category: 'Core Moves', name: 'Jumping Tiger', description: 'A leaping attack with full extension' },
      { category: 'Core Moves', name: 'Jumping Tiger II', description: 'Advanced version with double kick' },
      { category: 'Core Moves', name: "The 'I' Move", description: 'Straight thrust with body alignment' },
      { category: 'Core Moves', name: 'The Tradition', description: 'Classic form sequence' },
      { category: 'Core Moves', name: 'Thorn', description: 'Rapid multi-angle attack' },
      { category: 'Core Moves', name: 'Akira', description: 'Flowing combination' },
      { category: 'Core Moves', name: 'Double Thrust / Triple Thrust', description: 'Rapid successive thrusts' },
      { category: 'Core Moves', name: 'Illusion', description: 'Feint-based deceptive attack' },
      { category: 'Core Moves', name: 'Mantis', description: 'Hooking and trapping technique' },
      { category: 'Core Moves', name: 'Whispering Wind', description: 'Fast, quiet footwork entry' },
    ];
    for (const m of coreMoves) {
      await coreMovesRepo.create(m);
    }
    console.log('  ✓ Core Moves');
  }

  // Dalmater Colors
  if ((await dalmaterColorsRepo.findAll()).length === 0) {
    const colors = [
      { kaiden: 'Head Kaiden Gad', color: 'Jade Green', kaidenOrder: 1, isRedDalmater: false },
      { kaiden: 'Kaiden Joseph (retired)', color: 'Jade Green', kaidenOrder: 2, isRedDalmater: false },
      { kaiden: 'Kaiden Nikon', color: 'Black', kaidenOrder: 3, isRedDalmater: false },
      { kaiden: 'Kaiden Storm (retired)', color: 'Cobalt Blue', kaidenOrder: 4, isRedDalmater: false },
      { kaiden: 'Kaiden Charles', color: 'Wasp Yellow', kaidenOrder: 5, isRedDalmater: false },
      { kaiden: 'Kaiden Hedge (retired)', color: 'Shadow Grey', kaidenOrder: 6, isRedDalmater: false },
      { kaiden: 'Kaiden David', color: 'Shadow Grey', kaidenOrder: 7, isRedDalmater: false },
      { kaiden: 'Kaiden Kris (retired)', color: 'White', kaidenOrder: 8, isRedDalmater: false },
      { kaiden: 'Kaiden Severer', color: 'White', kaidenOrder: 9, isRedDalmater: false },
      { kaiden: 'Kaiden Eric', color: 'Forest Green', kaidenOrder: 10, isRedDalmater: false },
      { kaiden: 'Kaiden Vea Ravenstar', color: 'Nile Blue', kaidenOrder: 11, isRedDalmater: false },
      { kaiden: 'Honorary Kaiden Dominique', color: 'Nile Blue', kaidenOrder: 12, isRedDalmater: false },
      { kaiden: 'Kaiden Blight (retired)', color: 'Dark Purple', kaidenOrder: 13, isRedDalmater: false },
      { kaiden: 'Kaiden Umbra', color: 'Bronze', kaidenOrder: 14, isRedDalmater: false },
      { kaiden: 'Honorary Kaiden Dalton', color: 'Bronze', kaidenOrder: 15, isRedDalmater: false },
      { kaiden: 'Kaiden Brokkr (retired)', color: 'Amethyst', kaidenOrder: 16, isRedDalmater: false },
      { kaiden: 'Kaiden Daniel', color: 'Royal Blue', kaidenOrder: 17, isRedDalmater: false },
      { kaiden: 'Kaiden Requiem', color: 'Tornado Blue', kaidenOrder: 18, isRedDalmater: false },
      { kaiden: 'Red Dalmater', color: 'Red', kaidenOrder: 99, isRedDalmater: true, requirements: ['Be at least Crimson Chain', 'Petition Council and Head Kaiden', 'Inform your Kaiden', 'Take one month contract', 'Tour Trials of Swordsmanship (optional)', 'Complete One Hour Non-Stop Battle', 'Witnessed by Silver Chain+ Kaiden', 'Filmed when possible', 'Awarded Red Dalmater and script'] },
    ];
    for (const c of colors) {
      await dalmaterColorsRepo.create(c);
    }
    console.log('  ✓ Dalmater Colors');
  }

  // Kaidens
  if ((await kaidensRepo.findAll()).length === 0) {
    await kaidensRepo.create({
      section: 'theWay',
      title: 'The Way of the Sword Teacher',
      content: 'This perchance is the hardest road a swordsperson can walk. He must teach those people that are truly qualified, The Art of The Sword. This is often a road of pain, blood, bruises, harshness, broken vows, fallen students and failing interest. The true student is rare and the benefits are few, but every now and again you stumble on a truly honorable student that holds the essence of the sword. In them is a refuge, a long awaited peace. In all students there is a hope that you are looked up to as a respected Kaiden. On their days of victory, you as well feel their joy. As they grow so do you. Even in the worst of students, there is a sense of knowing you will not be forgotten. It is not a job to be a Kaiden, but it is hard work for the soul. In the end, the fee is never enough. But the pay can last a long, long time. The term Kaiden originally was a Japanese term that referred to a script that as provided to a student after they had completed their training. We have adapted that term slightly and it now directly translates into "Sword Teacher". It is the one who bears the right to teach steel and bokken. This person bears the right to teach and bring in new sword students and True Students. His or her word in the arena is of the strictest council. His price for training is respect and his reward is the student\'s growth. The rank of Kaiden can only be given by the Head Kaiden, who is appointed by the Council of Swordfighters. In the WCoS abroad the word Kaiden or Teacher should be given respect.'
    });

    // Kaiden Rules
    const rules = [
      { number: 1, title: 'ADHERING TO STUDENT REQUIREMENTS', content: 'Kaidens must ensure all students meet the established requirements for each rank before promotion.' },
      { number: 2, title: 'MAINTAINING HIGHER SKILL LEVEL', content: 'Kaidens must maintain a skill level higher than their highest-ranking student.' },
      { number: 3, title: 'CLASS LOGS AND DOCUMENTATION', content: 'Detailed class logs must be maintained for each session.' },
      { number: 4, title: 'NOTIFICATION & MONTHLY REPORTING', content: 'Monthly reports must be submitted to the Head Kaiden.' },
      { number: 5, title: 'CLASS FREQUENCY REQUIREMENTS', content: 'Minimum class frequency standards must be met.' },
      { number: 6, title: 'ANNUAL TEACHING REQUIREMENT', content: 'Kaidens must teach a minimum number of classes per year.' },
      { number: 7, title: 'ONGOING INSTRUCTION REQUIREMENT', content: 'Continuous instruction without extended gaps.' },
      { number: 8, title: 'MORAL CHARACTER & LEADERSHIP', content: 'Kaidens must exemplify the highest moral character.' },
      { number: 9, title: 'DOJO RESPONSIBILITY & SAFETY', content: 'Dojo safety is the Kaiden\'s primary responsibility.' },
      { number: 10, title: 'TRAINING DISCRETION & WCOS ADJUSTMENTS', content: 'Kaidens have discretion in training methods within WCoS guidelines.' },
      { number: 11, title: 'MONTHLY REPORT STRUCTURE', content: 'Reports must follow the standardized format.' },
      { number: 12, title: 'PROFESSIONAL NEUTRALITY & ETHICAL CONDUCT', content: 'Kaidens must maintain professional neutrality.' },
    ];
    for (const r of rules) {
      await kaidenRulesRepo.create(r);
    }
    console.log('  ✓ Kaidens & Rules');
  }

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

  // Dues
  if ((await duesRepo.findAll()).length === 0) {
    await duesRepo.create({
      nonProfit: 'The Western Circle of Swordfighters is a non-profit organization and all active (sparring) members are asked to donate annual dues of $50.00 per person. In response to donations, Members will receive a WCoS member card, which will be required to participate in any form of combat sparring at a sanctioned Western Circle event or class.',
      memberContributions: 'The dues cover the cost of maintaining the website, liability insurance (to obtain permits to hold events in public areas), incorporation costs, limited class supplies and anything else needed to maintain the WCoS as an official organization. Please make donations with the below form or through your Kaiden (teacher).',
      donateText: 'DONATE SECURELY WITH ANY MAJOR CREDIT CARD THROUGH PAYPAL!',
      amountOptions: ['50.00', '100.00'],
      rankOptions: ['L1 - Trainee', 'L2 - Green Braid', 'L3 - White Rope', 'L4 - Red Rope', 'L5 - Crimson Chain', 'L6 - Silver Chain', 'L7 - Copper Chain', '(other)'],
      dojoOptions: ['CA - Hayward', 'CA - Redding', 'CA - San Diego (Escondido)', 'KY - Louisville', 'NV - Gardnerville', 'OR - Portland (Beaverton)', 'WA - Seattle', '(other/none)'],
      paypalEmail: 'westerncouncil@gmail.com',
      active: true,
    });
    console.log('  ✓ Dues');
  }

  // Admin user
  if ((await usersRepo.findAll()).length === 0) {
    await authService.initializeAdmin();
    console.log('  ✓ Admin user');
  }

  // Dynamic Pages
  if ((await pagesRepo.findAll()).length === 0) {
    const pages = [
      { title: 'Fighter Class', slug: 'fighter-class', content: '<p>Content coming soon...</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Armor', slug: 'armor', content: '<p>Content coming soon...</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Weapons', slug: 'weapons', content: '<p>Content coming soon...</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Sparring', slug: 'sparring', content: '<p>Content coming soon...</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Sword Dance', slug: 'sword-dance', content: '<p>Content coming soon...</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Glossary', slug: 'glossary', content: '<p>Content coming soon...</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'WCOS Etiquette & Rules', slug: 'wcos-etiquette-rules', content: '<p>Main etiquette and rules page content.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Three Rules of Swordsmanship', slug: 'three-rules-of-swordsmanship', content: '<p>Three Rules content.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Six Traditions', slug: 'six-traditions', content: '<p>Six Traditions content.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'WCoS Rules', slug: 'wcos-rules', content: '<p>WCoS Rules content.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Western Circle Swordfighters Rules', slug: 'western-circle-swordfighters-rules', content: '<p>Western Circle of Swordfighters Rules content.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Western Circle Kaidens Rules', slug: 'western-circle-kaidens-rules', content: '<p>Western Circle Kaidens\' Rules content.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Event Hosting Rules', slug: 'event-hosting-rules', content: '<p>Event Hosting Rules content.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Event Rules', slug: 'event-rules', content: '<p>Event Rules content.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Combat Rules', slug: 'combat-rules', content: '<p>Combat Rules content.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Contact Us', slug: 'contact-us', content: '<p>Contact us page content.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Previous Updates', slug: 'previous-updates', content: '<p>Previous updates and announcements.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
      { title: 'Photo Gallery', slug: 'photo-gallery', content: '<p>Photo gallery coming soon.</p>', published: true, dataSources: [], templatePartial: null, layout: null, parentSlug: null, styleOverrides: null },
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