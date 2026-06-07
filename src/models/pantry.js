import db from '../db.js';
import { normalizeName } from '../lib/units.js';

export function allPantry() {
  return db.prepare('SELECT * FROM pantry_items ORDER BY name COLLATE NOCASE ASC').all();
}

export function getPantry(id) {
  return db.prepare('SELECT * FROM pantry_items WHERE id = ?').get(id);
}

// Map normalisierter Name -> { name, amount, unit } für den Live-Abgleich.
export function pantryMap() {
  const map = {};
  for (const item of allPantry()) {
    map[item.name_norm] = { name: item.name, amount: item.amount, unit: item.unit };
  }
  return map;
}

// Legt einen Eintrag an oder aktualisiert ihn (Schlüssel: normalisierter Name).
export function upsertPantry({ name, amount, unit }) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  const nameNorm = normalizeName(clean);
  const amt = amount === '' || amount == null ? null : Number(amount);
  db.prepare(
    `INSERT INTO pantry_items (name, name_norm, amount, unit, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(name_norm) DO UPDATE SET
       name = excluded.name,
       amount = excluded.amount,
       unit = excluded.unit,
       updated_at = datetime('now')`
  ).run(clean, nameNorm, Number.isNaN(amt) ? null : amt, String(unit || '').trim());
  return db.prepare('SELECT * FROM pantry_items WHERE name_norm = ?').get(nameNorm);
}

export function deletePantry(id) {
  return db.prepare('DELETE FROM pantry_items WHERE id = ?').run(id);
}
