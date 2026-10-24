/**
 * Reset Database Script
 * Deletes the database file and re-seeds from scratch
 */
import { initDatabase, getDatabase } from '../src/models/database.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resetDatabase() {
  const dbPath = path.resolve(__dirname, '../data/db.json');
  
  console.log('🗑️  Resetting database...');
  
  // Delete existing database file
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('  ✓ Deleted existing db.json');
  }
  
  // Re-initialize (will create fresh with defaults)
  await initDatabase();
  const db = getDatabase();
  
  // Clear all collections (keep schema defaults)
  const collections = [
    'pages', 'members', 'champions',
    'classes', 'ranks', 'coreMoves', 'dalmaterColors',
    'kaidens', 'kaidenRules', 'resources', 'dues',
    'siteSettings', 'navigation', 'users'
  ];
  
  for (const collection of collections) {
    db.data[collection] = [];
  }
  
  await db.write();
  console.log('  ✓ Cleared all collections');
  console.log('\n✅ Database reset complete!');
  console.log('Run `npm run db:seed` to populate with initial data.');
}

resetDatabase().catch(console.error);