import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './db.js'; // initializes database & schema
import { seedDemo } from './seed.js';
import pagesRouter from './routes/pages.js';
import apiRouter from './routes/api.js';
import { formatAmount, formatTime, formatDate } from './lib/format.js';
import { makeT, clientStrings } from './lib/i18n.js';
import { attachAuth, loginPossible, bootstrapAdmin } from './lib/auth.js';
import { oidcEnabled } from './lib/oidc.js';

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
app.locals.formatDate = formatDate;
// Changes on every (re)start -> busts the browser cache for CSS/JS after deploys
app.locals.assetVersion = process.env.ASSET_VERSION || String(Date.now());

// Body parsers for forms and JSON (a bit of headroom for avatar data URLs)
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

// Static files (CSS, client JS). Scripts revalidate so a deploy cannot leave a stale one behind.
app.use(
  '/static',
  express.static(path.join(projectRoot, 'public'), {
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

// Translations, navigation & search box for all views
const t = makeT();
// string table for the browser modules, safe to embed in a <script> tag
const i18nJson = JSON.stringify(clientStrings()).replace(/</g, '\\u003c');
app.use((req, res, next) => {
  req.t = t;
  res.locals.t = t;
  res.locals.i18nJson = i18nJson;
  res.locals.currentPath = req.path;
  res.locals.currentUrl = req.originalUrl;
  res.locals.searchQuery = req.query.q || '';
  next();
});

// Auth state (read-only vs. logged-in) for all views and route guards
app.use(attachAuth);

// Routes
app.use('/api', apiRouter);
app.use('/', pagesRouter);

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: req.t('title_not_found') });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: t('title_error'),
    message: process.env.NODE_ENV === 'production' ? '' : String(err && err.stack ? err.stack : err),
  });
});

// Create the first admin account from AUTH_USER/AUTH_PASSWORD if needed
try {
  bootstrapAdmin();
} catch (e) {
  console.error('Could not bootstrap admin account:', e);
}

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
  if (loginPossible()) {
    console.log('Edit protection is ON - log in at /login to edit. Manage accounts under Settings.');
  } else {
    console.log('Edit protection: read-only mode (set AUTH_PASSWORD to bootstrap the first account).');
  }
  if (oidcEnabled()) console.log(`Single sign-on is ON (issuer ${process.env.OIDC_ISSUER}).`);
});
