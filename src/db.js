import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Storage location of the database. Configurable via DATA_DIR (e.g. Docker volume).
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(projectRoot, 'data');

fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'recipes.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name  TEXT NOT NULL DEFAULT '',
    pass_hash     TEXT NOT NULL,
    pass_salt     TEXT NOT NULL,
    avatar        TEXT NOT NULL DEFAULT '',
    is_admin      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT NOT NULL UNIQUE,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    image_url     TEXT NOT NULL DEFAULT '',
    servings      REAL NOT NULL DEFAULT 4,
    servings_unit TEXT NOT NULL DEFAULT 'Portionen',
    prep_time     INTEGER NOT NULL DEFAULT 0,
    cook_time     INTEGER NOT NULL DEFAULT 0,
    rest_time     INTEGER NOT NULL DEFAULT 0,
    difficulty    TEXT NOT NULL DEFAULT 'Medium',
    notes         TEXT NOT NULL DEFAULT '',
    author_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_name   TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position  INTEGER NOT NULL DEFAULT 0,
    amount    REAL,
    unit      TEXT NOT NULL DEFAULT '',
    name      TEXT NOT NULL,
    note      TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON ingredients(recipe_id);

  CREATE TABLE IF NOT EXISTS steps (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position  INTEGER NOT NULL DEFAULT 0,
    text      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_steps_recipe ON steps(recipe_id);

  CREATE TABLE IF NOT EXISTS tags (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS recipe_tags (
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag_id    INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS pantry_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    name_norm  TEXT NOT NULL UNIQUE,
    unit       TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pantry_batches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id     INTEGER NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
    amount      REAL,
    best_before TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pantry_batches_item ON pantry_batches(item_id);

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// --- Migrations for databases created before a column existed ---------------
function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}
if (!hasColumn('recipes', 'author_id')) {
  // ALTER ... ADD COLUMN can't reliably carry a foreign key across SQLite
  // versions; deleteUser() nulls authored recipes explicitly instead.
  db.exec('ALTER TABLE recipes ADD COLUMN author_id INTEGER');
}
if (!hasColumn('recipes', 'author_name')) {
  // Snapshot of the author's name, taken when the recipe is created. It
  // survives account deletion so a recipe can still show a creator label
  // ("deleted user") instead of a blank once the account is gone.
  db.exec("ALTER TABLE recipes ADD COLUMN author_name TEXT NOT NULL DEFAULT ''");
  // Backfill the snapshot for recipes that already have a live author.
  db.exec(`
    UPDATE recipes
       SET author_name = COALESCE(
         (SELECT NULLIF(display_name, '') FROM users WHERE users.id = recipes.author_id),
         (SELECT username FROM users WHERE users.id = recipes.author_id),
         ''
       )
     WHERE author_id IS NOT NULL
  `);
}
if (!hasColumn('recipes', 'rest_time')) {
  // The single "cook" time was split into three fields (active / cook-or-bake /
  // resting time). Older databases only have prep_time and cook_time; resting
  // time starts at 0 for them.
  db.exec('ALTER TABLE recipes ADD COLUMN rest_time INTEGER NOT NULL DEFAULT 0');
}
if (!hasColumn('users', 'is_admin')) {
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
  // Promote the first (bootstrapped) account so existing installs keep an admin
  // who can manage user accounts.
  db.exec('UPDATE users SET is_admin = 1 WHERE id = (SELECT MIN(id) FROM users)');
}
if (hasColumn('pantry_items', 'amount')) {
  // Amounts moved into pantry_batches (one row per best-before date); every
  // existing item becomes a single batch without a date.
  db.transaction(() => {
    db.exec('INSERT INTO pantry_batches (item_id, amount) SELECT id, amount FROM pantry_items');
    db.exec('ALTER TABLE pantry_items DROP COLUMN amount');
  })();
}
if (!hasColumn('users', 'oidc_sub')) {
  // Subject of the linked single sign-on account. SQLite can't add a UNIQUE
  // column, so uniqueness comes from the index (NULLs don't collide).
  db.exec('ALTER TABLE users ADD COLUMN oidc_sub TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_oidc_sub ON users(oidc_sub)');
}

if (!db.prepare("SELECT 1 FROM meta WHERE key = 'units_de'").get()) {
  // The UI became German only; units typed or picked in English are rewritten
  // once. Matching treats both spellings alike (src/lib/units.js).
  const UNITS = {
    pcs: 'Stk.', pc: 'Stk.', piece: 'Stk.', pieces: 'Stk.',
    tbsp: 'EL', tsp: 'TL', pinch: 'Prise', pinches: 'Prisen',
    packet: 'Pck.', packets: 'Pck.', clove: 'Zehe', cloves: 'Zehen',
    bunch: 'Bund', can: 'Dose', cans: 'Dosen', cup: 'Tasse', cups: 'Tassen',
    slice: 'Scheibe', slices: 'Scheiben',
  };
  const SERVINGS = { servings: 'Portionen', slices: 'Stücke', glasses: 'Gläser' };
  db.transaction(() => {
    const ing = db.prepare('UPDATE ingredients SET unit = ? WHERE lower(trim(unit)) = ?');
    const pan = db.prepare('UPDATE pantry_items SET unit = ? WHERE lower(trim(unit)) = ?');
    for (const [en, de] of Object.entries(UNITS)) {
      ing.run(de, en);
      pan.run(de, en);
    }
    const srv = db.prepare('UPDATE recipes SET servings_unit = ? WHERE lower(trim(servings_unit)) = ?');
    for (const [en, de] of Object.entries(SERVINGS)) srv.run(de, en);
    db.prepare("INSERT INTO meta (key, value) VALUES ('units_de', '1')").run();
  })();
}

export function getMeta(key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setMeta(key, value) {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value));
}

export { dbPath, dataDir };
export default db;
