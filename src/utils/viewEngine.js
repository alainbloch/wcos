/**
 * View Engine Setup
 * Configures Nunjucks template engine for Fastify
 */
import nunjucks from 'nunjucks';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viewsPath = path.resolve(__dirname, '../views');

export function setupViewEngine(fastify) {
  // Configure Nunjucks without Express integration
  const env = nunjucks.configure(viewsPath, {
    autoescape: true,
    watch: config.nodeEnv === 'development',
    noCache: config.nodeEnv === 'development',
  });

  // Add global filters
  env.addFilter('date', (value, format = 'MMM d, yyyy') => {
    if (!value) return '';
    const date = new Date(value);
    return formatDate(date, format);
  });

  env.addFilter('slugify', (value) => {
    if (!value) return '';
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  });

  env.addFilter('truncate', (value, length = 150) => {
    if (!value) return '';
    if (value.length <= length) return value;
    return value.substring(0, length).trim() + '...';
  });

  env.addFilter('markdown', (value) => {
    if (!value) return '';
    // Simple markdown-like processing
    return value
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  });

  // Convert object to array of {key, value} for iteration
  env.addFilter('entries', (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  });

  // Add global variables
  env.addGlobal('siteName', config.siteName);
  env.addGlobal('siteUrl', config.siteUrl);
  env.addGlobal('nodeEnv', config.nodeEnv);
  env.addGlobal('currentYear', new Date().getFullYear());

  // Make env available on fastify instance
  fastify.decorate('nunjucks', env);

  return env;
}

function formatDate(date, format) {
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (format.includes('MMMM')) options.month = 'long';
  if (format.includes('dd')) options.day = '2-digit';

  return date.toLocaleDateString('en-US', options);
}

export function renderView(fastify, template, context = {}) {
  return new Promise((resolve, reject) => {
    fastify.nunjucks.render(template, context, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}