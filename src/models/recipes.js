import db from '../db.js';
import { uniqueSlug } from '../lib/slug.js';
import { setRecipeTags, tagsForRecipeIds } from './tags.js';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

function parseAmount(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseIntOr(v, fallback = 0) {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Turns raw form data into a clean recipe object.
function sanitize(data) {
  const servings = parseAmount(data.servings);
  return {
    title: String(data.title || '').trim() || 'Untitled recipe',
    description: String(data.description || '').trim(),
    image_url: String(data.image_url || '').trim(),
    servings: servings && servings > 0 ? servings : 4,
    servings_unit: String(data.servings_unit || '').trim() || 'Servings',
    prep_time: parseIntOr(data.prep_time, 0),
    cook_time: parseIntOr(data.cook_time, 0),
    difficulty: DIFFICULTIES.includes(data.difficulty) ? data.difficulty : 'Medium',
    notes: String(data.notes || '').trim(),
    author_id: data.author_id != null && data.author_id !== '' ? Number(data.author_id) : null,
    author_name: String(data.author_name || '').trim(),
    tags: Array.isArray(data.tags) ? data.tags : [],
    ingredients: (Array.isArray(data.ingredients) ? data.ingredients : [])
      .map((i) => ({
        amount: parseAmount(i.amount),
        unit: String(i.unit || '').trim(),
        name: String(i.name || '').trim(),
        note: String(i.note || '').trim(),
      }))
      .filter((i) => i.name !== ''),
    steps: (Array.isArray(data.steps) ? data.steps : [])
      .map((s) => String(s || '').trim())
      .filter((s) => s !== ''),
  };
}

const insertRecipeStmt = db.prepare(`
  INSERT INTO recipes
    (slug, title, description, image_url, servings, servings_unit, prep_time, cook_time, difficulty, notes, author_id, author_name)
  VALUES
    (@slug, @title, @description, @image_url, @servings, @servings_unit, @prep_time, @cook_time, @difficulty, @notes, @author_id, @author_name)
`);
const insertIngredientStmt = db.prepare(`
  INSERT INTO ingredients (recipe_id, position, amount, unit, name, note)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertStepStmt = db.prepare(`
  INSERT INTO steps (recipe_id, position, text) VALUES (?, ?, ?)
`);

function writeChildren(recipeId, clean) {
  clean.ingredients.forEach((ing, idx) =>
    insertIngredientStmt.run(recipeId, idx, ing.amount, ing.unit, ing.name, ing.note)
  );
  clean.steps.forEach((text, idx) => insertStepStmt.run(recipeId, idx, text));
  setRecipeTags(recipeId, clean.tags);
}

export const createRecipe = db.transaction((data) => {
  const clean = sanitize(data);
  const slug = uniqueSlug(clean.title, (s) =>
    db.prepare('SELECT 1 FROM recipes WHERE slug = ?').get(s)
  );
  const info = insertRecipeStmt.run({ ...clean, slug });
  writeChildren(info.lastInsertRowid, clean);
  return slug;
});

export const updateRecipe = db.transaction((id, data) => {
  const clean = sanitize(data);
  const current = db.prepare('SELECT slug, title FROM recipes WHERE id = ?').get(id);
  if (!current) return null;

  // Only assign a new slug when the title has changed.
  let slug = current.slug;
  if (clean.title !== current.title) {
    slug = uniqueSlug(clean.title, (s) =>
      db.prepare('SELECT 1 FROM recipes WHERE slug = ? AND id != ?').get(s, id)
    );
  }

  db.prepare(`
    UPDATE recipes SET
      slug=@slug, title=@title, description=@description, image_url=@image_url,
      servings=@servings, servings_unit=@servings_unit, prep_time=@prep_time,
      cook_time=@cook_time, difficulty=@difficulty, notes=@notes,
      updated_at=datetime('now')
    WHERE id=@id
  `).run({ ...clean, slug, id });

  db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(id);
  db.prepare('DELETE FROM steps WHERE recipe_id = ?').run(id);
  writeChildren(id, clean);
  return slug;
});

export function deleteRecipe(id) {
  return db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
}

function hydrate(recipe) {
  if (!recipe) return null;
  recipe.ingredients = db
    .prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY position, id')
    .all(recipe.id);
  recipe.steps = db
    .prepare('SELECT * FROM steps WHERE recipe_id = ? ORDER BY position, id')
    .all(recipe.id);
  recipe.tags = tagsForRecipeIds([recipe.id]).get(recipe.id) || [];
  return recipe;
}

export function getRecipeBySlug(slug) {
  return hydrate(db.prepare('SELECT * FROM recipes WHERE slug = ?').get(slug));
}

export function getRecipeById(id) {
  return hydrate(db.prepare('SELECT * FROM recipes WHERE id = ?').get(id));
}

export function countRecipes() {
  return db.prepare('SELECT COUNT(*) AS c FROM recipes').get().c;
}

// Attaches tags to a list of recipe rows.
function attachTags(rows) {
  const map = tagsForRecipeIds(rows.map((r) => r.id));
  for (const r of rows) r.tags = map.get(r.id) || [];
  return rows;
}

// Overview list, optionally filtered by tag slug and/or author (owner) id.
// Both filters combine (AND), so "Desserts by Anna" works.
export function listRecipes({ tagSlug, authorId } = {}) {
  const where = [];
  const params = [];
  let join = '';
  if (tagSlug) {
    join = `JOIN recipe_tags rt ON rt.recipe_id = r.id
         JOIN tags t ON t.id = rt.tag_id`;
    where.push('t.slug = ?');
    params.push(tagSlug);
  }
  if (authorId) {
    where.push('r.author_id = ?');
    params.push(authorId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT r.* FROM recipes r
       ${join}
       ${whereSql}
       ORDER BY r.created_at DESC, r.id DESC`
    )
    .all(...params);
  return attachTags(rows);
}

// Recipe owners (users who authored at least one recipe) with their counts,
// for the owner filter on the overview.
export function authorsWithCounts() {
  return db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar, COUNT(r.id) AS count
       FROM users u
       JOIN recipes r ON r.author_id = u.id
       GROUP BY u.id
       ORDER BY count DESC, u.username COLLATE NOCASE ASC`
    )
    .all();
}

// Folds case for a tolerant search.
function fold(s) {
  return String(s || '').toLowerCase();
}

// Full-text search with title priority.
// Title matches (weight 100) ALWAYS rank above content-only matches (max ~42),
// i.e. "lemon" returns the "Lemon Cake" first, then recipes that merely use
// lemon as an ingredient.
export function searchRecipes(query) {
  const q = fold(query.trim());
  if (!q) return [];

  const rows = db
    .prepare(
      `SELECT r.*,
         (SELECT group_concat(name, ' ')  FROM ingredients WHERE recipe_id = r.id) AS ing_text,
         (SELECT group_concat(text, ' ')  FROM steps       WHERE recipe_id = r.id) AS step_text,
         (SELECT group_concat(t.name, ' ') FROM recipe_tags rt
            JOIN tags t ON t.id = rt.tag_id WHERE rt.recipe_id = r.id) AS tag_text
       FROM recipes r`
    )
    .all();

  const scored = [];
  for (const r of rows) {
    let score = 0;
    let titleMatch = false;

    const title = fold(r.title);
    if (title.includes(q)) {
      score += 100;
      titleMatch = true;
      if (title.startsWith(q)) score += 25; // exact word start ranks a bit higher
    }
    if (fold(r.description).includes(q)) score += 12;
    if (fold(r.ing_text).includes(q)) score += 10;
    if (fold(r.tag_text).includes(q)) score += 8;
    if (fold(r.step_text).includes(q)) score += 7;
    if (fold(r.notes).includes(q)) score += 5;

    if (score > 0) {
      r._score = score;
      r._titleMatch = titleMatch;
      scored.push(r);
    }
  }

  scored.sort((a, b) => b._score - a._score || a.title.localeCompare(b.title, 'en'));
  return attachTags(scored);
}
