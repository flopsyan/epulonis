import express from 'express';
import { searchRecipes } from '../models/recipes.js';

const router = express.Router();

// Live-Suche für das Suchfeld (Titel-Priorität, dann Inhalt).
router.get('/suche', (req, res) => {
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

export default router;
