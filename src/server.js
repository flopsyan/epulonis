import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './db.js'; // initialisiert Datenbank & Schema
import { seedDemo } from './seed.js';
import pagesRouter from './routes/pages.js';
import apiRouter from './routes/api.js';
import { formatAmount, formatTime } from './lib/format.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const app = express();
app.set('trust proxy', true);

// View-Engine (EJS) + Templates
app.set('view engine', 'ejs');
app.set('views', path.join(projectRoot, 'views'));

// In Templates verfügbare Helfer & Konstanten
app.locals.siteName = process.env.SITE_NAME || 'Epulonis';
app.locals.formatAmount = formatAmount;
app.locals.formatTime = formatTime;

// Body-Parser für Formulare und JSON
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

// Statische Dateien (CSS, Client-JS)
app.use(
  '/static',
  express.static(path.join(projectRoot, 'public'), { maxAge: '1h' })
);

// Für Navigation & Suchfeld in allen Views
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.searchQuery = req.query.q || '';
  next();
});

// Routen
app.use('/api', apiRouter);
app.use('/', pagesRouter);

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Nicht gefunden' });
});

// Fehlerbehandlung
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Fehler',
    message: process.env.NODE_ENV === 'production' ? 'Es ist ein Fehler aufgetreten.' : String(err && err.stack ? err.stack : err),
  });
});

// Beim Start ggf. Beispieldaten einspielen
if (process.env.SEED_DEMO !== 'false') {
  try {
    if (seedDemo()) console.log('✓ Beispieldaten eingespielt.');
  } catch (e) {
    console.error('Beispieldaten konnten nicht eingespielt werden:', e);
  }
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`${app.locals.siteName} läuft auf http://localhost:${port}`);
});
