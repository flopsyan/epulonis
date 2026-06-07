import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './db.js'; // initializes database & schema
import { seedDemo } from './seed.js';
import pagesRouter from './routes/pages.js';
import apiRouter from './routes/api.js';
import { formatAmount, formatTime } from './lib/format.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const app = express();
app.set('trust proxy', true);

// View engine (EJS) + templates
app.set('view engine', 'ejs');
app.set('views', path.join(projectRoot, 'views'));

// Helpers & constants available in templates
app.locals.siteName = process.env.SITE_NAME || 'Epulonis';
app.locals.formatAmount = formatAmount;
app.locals.formatTime = formatTime;

// Body parsers for forms and JSON
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

// Static files (CSS, client JS)
app.use(
  '/static',
  express.static(path.join(projectRoot, 'public'), { maxAge: '1h' })
);

// For navigation & search box in all views
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.searchQuery = req.query.q || '';
  next();
});

// Routes
app.use('/api', apiRouter);
app.use('/', pagesRouter);

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not found' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : String(err && err.stack ? err.stack : err),
  });
});

// Seed demo data on startup if needed
if (process.env.SEED_DEMO !== 'false') {
  try {
    if (seedDemo()) console.log('Demo data seeded.');
  } catch (e) {
    console.error('Could not seed demo data:', e);
  }
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`${app.locals.siteName} is running at http://localhost:${port}`);
});
