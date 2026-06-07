import express from 'express';
import { searchRecipes } from '../models/recipes.js';
import { consumePantry, pantryMap } from '../models/pantry.js';
import { requireAuthApi } from '../lib/auth.js';

const router = express.Router();

function parseAmount(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Live search for the search box (title priority, then content).
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ query: q, results: [] });

  const results = searchRecipes(q)
    .slice(0, 8)
    .map((r) => ({
      title: r.title,
      slug: r.slug,
      description: r.description,
      image_url: r.image_url,
      difficulty: r.difficulty,
      tags: r.tags,
      titleMatch: Boolean(r._titleMatch),
    }));

  res.json({ query: q, results });
});

// Subtract used amounts from the pantry (requires login).
// Body: { items: [{ name, amount, unit }] }
router.post('/pantry/consume', requireAuthApi, (req, res) => {
  const raw = Array.isArray(req.body?.items) ? req.body.items : [];
  const items = raw
    .map((i) => ({
      name: String(i?.name || '').trim(),
      amount: parseAmount(i?.amount),
      unit: String(i?.unit || '').trim(),
    }))
    .filter((i) => i.name && i.amount != null && i.amount > 0);

  const results = consumePantry(items);
  res.json({ ok: true, results, pantry: pantryMap() });
});

export default router;
