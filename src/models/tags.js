import db from '../db.js';
import { slugify } from '../lib/slug.js';

export function getOrCreateTag(name) {
  const clean = String(name).trim();
  if (!clean) return null;
  const existing = db.prepare('SELECT * FROM tags WHERE name = ? COLLATE NOCASE').get(clean);
  if (existing) return existing;

  // find a unique slug
  let slug = slugify(clean);
  let i = 2;
  while (db.prepare('SELECT 1 FROM tags WHERE slug = ?').get(slug)) {
    slug = `${slugify(clean)}-${i++}`;
  }
  const info = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)').run(clean, slug);
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid);
}

export function setRecipeTags(recipeId, names) {
  db.prepare('DELETE FROM recipe_tags WHERE recipe_id = ?').run(recipeId);
  const link = db.prepare(
    'INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)'
  );
  const seen = new Set();
  for (const name of names || []) {
    const tag = getOrCreateTag(name);
    if (tag && !seen.has(tag.id)) {
      link.run(recipeId, tag.id);
      seen.add(tag.id);
    }
  }
}

export function getTagBySlug(slug) {
  return db.prepare('SELECT * FROM tags WHERE slug = ?').get(slug);
}

// All tags with the number of associated recipes (for the filter bar).
export function allTagsWithCounts() {
  return db
    .prepare(
      `SELECT t.id, t.name, t.slug, COUNT(rt.recipe_id) AS count
       FROM tags t
       LEFT JOIN recipe_tags rt ON rt.tag_id = t.id
       GROUP BY t.id
       HAVING count > 0
       ORDER BY count DESC, t.name COLLATE NOCASE ASC`
    )
    .all();
}

// Tags for a set of recipe IDs as a map { recipeId: [{name, slug}] }.
export function tagsForRecipeIds(ids) {
  const map = new Map();
  if (!ids.length) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT rt.recipe_id, t.name, t.slug
       FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id
       WHERE rt.recipe_id IN (${placeholders})
       ORDER BY t.name COLLATE NOCASE ASC`
    )
    .all(...ids);
  for (const r of rows) {
    if (!map.has(r.recipe_id)) map.set(r.recipe_id, []);
    map.get(r.recipe_id).push({ name: r.name, slug: r.slug });
  }
  return map;
}
