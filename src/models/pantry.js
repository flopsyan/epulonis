import db from '../db.js';
import { normalizeName, consumeAmount } from '../lib/units.js';

export function allPantry() {
  return db.prepare('SELECT * FROM pantry_items ORDER BY name COLLATE NOCASE ASC').all();
}

export function getPantry(id) {
  return db.prepare('SELECT * FROM pantry_items WHERE id = ?').get(id);
}

// Map of normalized name -> { name, amount, unit } for the live match.
export function pantryMap() {
  const map = {};
  for (const item of allPantry()) {
    map[item.name_norm] = { name: item.name, amount: item.amount, unit: item.unit };
  }
  return map;
}

// Creates or updates an entry (key: normalized name).
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

// Subtracts a list of used amounts from the pantry (e.g. after cooking a
// recipe). Each item is matched by normalized name; amounts/units are converted
// automatically. Items without a match or with incomparable units are reported
// as skipped. Runs as a single transaction.
// items: [{ name, amount, unit }]
export const consumePantry = db.transaction((items) => {
  const findStmt = db.prepare('SELECT * FROM pantry_items WHERE name_norm = ?');
  const updateStmt = db.prepare(
    `UPDATE pantry_items SET amount = ?, updated_at = datetime('now') WHERE id = ?`
  );

  const results = [];
  for (const raw of items || []) {
    const name = String(raw?.name || '').trim();
    if (!name) continue;

    const item = findStmt.get(normalizeName(name));
    if (!item) {
      results.push({ name, status: 'missing' });
      continue;
    }

    const newAmount = consumeAmount(
      { amount: item.amount, unit: item.unit },
      { amount: raw.amount, unit: raw.unit }
    );
    if (newAmount == null) {
      results.push({ name, status: 'incompatible' });
      continue;
    }

    updateStmt.run(newAmount, item.id);
    results.push({ name, status: 'ok', newAmount, unit: item.unit });
  }
  return results;
});
