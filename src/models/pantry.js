import db from '../db.js';
import { normalizeName, normalizeUnit, toBase, baseToUnit } from '../lib/units.js';

const round = (n) => Math.round(n * 1000) / 1000;

function parseAmount(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Best-before dates are stored as YYYY-MM-DD (what <input type="date"> sends).
function parseDate(v) {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

// Earliest date first, undated batches last.
const BATCH_ORDER = 'ORDER BY best_before IS NULL, best_before, id';

function batchesOf(itemId) {
  return db.prepare(`SELECT id, amount, best_before FROM pantry_batches WHERE item_id = ? ${BATCH_ORDER}`).all(itemId);
}

// null when no batch has an amount ("in stock, amount unknown").
function total(batches) {
  const known = batches.filter((b) => b.amount != null);
  return known.length ? round(known.reduce((sum, b) => sum + b.amount, 0)) : null;
}

// Used-up batches disappear as soon as another batch is left. An item whose
// stock is completely used up keeps one empty, undated batch, so it stays
// listed with 0 as before.
function tidy(itemId) {
  const live = db
    .prepare('SELECT COUNT(*) AS n FROM pantry_batches WHERE item_id = ? AND (amount IS NULL OR amount > 0)')
    .get(itemId).n;
  if (live > 0) {
    db.prepare('DELETE FROM pantry_batches WHERE item_id = ? AND amount <= 0').run(itemId);
    return;
  }
  const keep = db.prepare('SELECT MIN(id) AS id FROM pantry_batches WHERE item_id = ?').get(itemId).id;
  if (keep == null) {
    db.prepare('DELETE FROM pantry_items WHERE id = ?').run(itemId);
    return;
  }
  db.prepare('DELETE FROM pantry_batches WHERE item_id = ? AND id <> ?').run(itemId, keep);
  db.prepare('UPDATE pantry_batches SET best_before = NULL WHERE id = ?').run(keep);
}

function touch(itemId) {
  db.prepare("UPDATE pantry_items SET updated_at = datetime('now') WHERE id = ?").run(itemId);
}

// Items with their batches, the summed amount and the earliest best-before date.
export function allPantry() {
  const byItem = new Map();
  for (const b of db.prepare(`SELECT id, item_id, amount, best_before FROM pantry_batches ${BATCH_ORDER}`).all()) {
    if (!byItem.has(b.item_id)) byItem.set(b.item_id, []);
    byItem.get(b.item_id).push({ id: b.id, amount: b.amount, best_before: b.best_before });
  }
  return db
    .prepare('SELECT * FROM pantry_items ORDER BY name COLLATE NOCASE ASC')
    .all()
    .map((item) => {
      const batches = byItem.get(item.id) || [];
      return {
        ...item,
        batches,
        amount: total(batches),
        best_before: batches.find((b) => b.best_before)?.best_before ?? null,
      };
    });
}

// Map of normalized name -> { name, amount, unit, batches } for the live match.
export function pantryMap() {
  const map = {};
  for (const item of allPantry()) {
    map[item.name_norm] = { id: item.id, name: item.name, amount: item.amount, unit: item.unit, batches: item.batches };
  }
  return map;
}

// Adds stock. A batch with the same best-before date (or the same missing
// date) gets the amount added, any other date becomes a batch of its own.
// Returns { error: 'unit' } when the unit can't be converted into the unit the
// item is already counted in.
export const addPantry = db.transaction(({ name, amount, unit, best_before }) => {
  const clean = String(name || '').trim();
  if (!clean) return null;
  const nameNorm = normalizeName(clean);
  const unitClean = String(unit || '').trim();
  const date = parseDate(best_before);
  let value = parseAmount(amount);

  let item = db.prepare('SELECT * FROM pantry_items WHERE name_norm = ?').get(nameNorm);
  if (!item) {
    const id = db
      .prepare('INSERT INTO pantry_items (name, name_norm, unit) VALUES (?, ?, ?)')
      .run(clean, nameNorm, unitClean).lastInsertRowid;
    db.prepare('INSERT INTO pantry_batches (item_id, amount, best_before) VALUES (?, ?, ?)').run(id, value, date);
    return { ok: true };
  }

  if (value != null && normalizeUnit(unitClean) !== normalizeUnit(item.unit)) {
    const from = toBase(value, unitClean);
    if (from.dimension === toBase(1, item.unit).dimension) {
      value = round(baseToUnit(from.value, item.unit));
    } else if (total(batchesOf(item.id))) {
      return { error: 'unit', unit: item.unit };
    } else {
      // Nothing measurable in stock yet, so the new unit simply takes over.
      db.prepare('UPDATE pantry_items SET unit = ? WHERE id = ?').run(unitClean, item.id);
    }
  }

  db.prepare("UPDATE pantry_items SET name = ?, updated_at = datetime('now') WHERE id = ?").run(clean, item.id);
  const same = db.prepare('SELECT * FROM pantry_batches WHERE item_id = ? AND best_before IS ?').get(item.id, date);
  if (same) {
    const next = value == null ? same.amount : round((same.amount ?? 0) + value);
    db.prepare('UPDATE pantry_batches SET amount = ? WHERE id = ?').run(next, same.id);
  } else {
    db.prepare('INSERT INTO pantry_batches (item_id, amount, best_before) VALUES (?, ?, ?)').run(item.id, value, date);
  }
  tidy(item.id);
  return { ok: true };
});

// Corrects one batch. The unit belongs to the whole item and is relabelled,
// not converted. Moving a batch onto a date another batch already has merges
// the two.
export const editBatch = db.transaction((batchId, { amount, unit, best_before }) => {
  const batch = db.prepare('SELECT * FROM pantry_batches WHERE id = ?').get(batchId);
  if (!batch) return null;
  const value = parseAmount(amount);
  const date = parseDate(best_before);
  db.prepare("UPDATE pantry_items SET unit = ?, updated_at = datetime('now') WHERE id = ?")
    .run(String(unit || '').trim(), batch.item_id);

  const twin = db
    .prepare('SELECT * FROM pantry_batches WHERE item_id = ? AND best_before IS ? AND id <> ?')
    .get(batch.item_id, date, batch.id);
  if (twin) {
    const next = value == null ? twin.amount : round((twin.amount ?? 0) + value);
    db.prepare('UPDATE pantry_batches SET amount = ? WHERE id = ?').run(next, twin.id);
    db.prepare('DELETE FROM pantry_batches WHERE id = ?').run(batch.id);
  } else {
    db.prepare('UPDATE pantry_batches SET amount = ?, best_before = ? WHERE id = ?').run(value, date, batch.id);
  }
  tidy(batch.item_id);
  return { ok: true };
});

export const deleteBatch = db.transaction((batchId) => {
  const batch = db.prepare('SELECT item_id FROM pantry_batches WHERE id = ?').get(batchId);
  if (!batch) return;
  db.prepare('DELETE FROM pantry_batches WHERE id = ?').run(batchId);
  touch(batch.item_id);
  tidy(batch.item_id);
});

export function deletePantry(id) {
  return db.prepare('DELETE FROM pantry_items WHERE id = ?').run(id);
}

// Subtracts a used amount from one item, starting with the chosen batch (or
// the one that expires first) and taking whatever is left over from the next
// batches. Returns the status in the shape consumePantry reports it.
function consumeItem(item, { amount, unit, batchId }) {
  const need = toBase(parseAmount(amount), unit);
  const batches = batchesOf(item.id).filter((b) => b.amount != null);
  if (!(need.value > 0) || !batches.length || need.dimension !== toBase(1, item.unit).dimension) {
    return { status: 'incompatible' };
  }
  const first = batches.findIndex((b) => b.id === Number(batchId));
  if (first > 0) batches.unshift(...batches.splice(first, 1));

  let left = baseToUnit(need.value, item.unit);
  const update = db.prepare('UPDATE pantry_batches SET amount = ? WHERE id = ?');
  for (const b of batches) {
    if (left <= 0) break;
    const take = Math.min(b.amount, left);
    update.run(round(b.amount - take), b.id);
    left = round(left - take);
  }
  touch(item.id);
  tidy(item.id);
  return { status: 'ok', newAmount: total(batchesOf(item.id)), unit: item.unit };
}

export const consumePantryItem = db.transaction((itemId, used) => {
  const item = db.prepare('SELECT * FROM pantry_items WHERE id = ?').get(itemId);
  return item ? consumeItem(item, used) : { status: 'missing' };
});

// Subtracts a list of used amounts from the pantry (e.g. after cooking a
// recipe). Each item is matched by normalized name; amounts/units are converted
// automatically. Items without a match or with incomparable units are reported
// as skipped. Runs as a single transaction.
// items: [{ name, amount, unit, batchId }]
export const consumePantry = db.transaction((items) => {
  const findStmt = db.prepare('SELECT * FROM pantry_items WHERE name_norm = ?');
  const results = [];
  for (const raw of items || []) {
    const name = String(raw?.name || '').trim();
    if (!name) continue;
    const item = findStmt.get(normalizeName(name));
    results.push(item ? { name, ...consumeItem(item, raw) } : { name, status: 'missing' });
  }
  return results;
});
