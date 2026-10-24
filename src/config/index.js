/**
 * Configuration Loader
 * Loads and validates environment configuration
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Preview runners supply host/port flags; explicit environment settings still win.
const cliValue = flag => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; };

const config = {
  // Server
  port: parseInt(process.env.PORT || cliValue('--port') || '3000', 10),
  host: process.env.HOST || cliValue('--host') || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Session
  sessionSecret: process.env.SESSION_SECRET || 'development-session-secret-change-before-deploying',
  sessionCookieName: 'wcos_session',

  // Database
  dbPath: process.env.DB_PATH || './data/db.json',

  // Admin
  adminEmail: process.env.ADMIN_EMAIL || 'admin@wcos.org',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  jwtExpiresIn: '7d',

  // Uploads
  uploadDir: process.env.UPLOAD_DIR || './public/uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),

  // PayPal
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    mode: process.env.PAYPAL_MODE || 'sandbox',
  },

  // Site
  siteName: 'Western Circle of Swordfighters',
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  siteEmail: 'westerncouncil@gmail.com',

  // Social
  social: {
    facebook: 'https://facebook.com/wcos',
    instagram: 'https://instagram.com/wcos',
    youtube: 'https://youtube.com/wcos',
  },

  // Pagination
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
};

// Validate required config in production
if (config.nodeEnv === 'production') {
  const required = ['SESSION_SECRET', 'JWT_SECRET', 'ADMIN_EMAIL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default config;