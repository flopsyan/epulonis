import express from 'express';
import {
  listRecipes,
  searchRecipes,
  getRecipeBySlug,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from '../models/recipes.js';
import { allTagsWithCounts, getTagBySlug } from '../models/tags.js';
import { allPantry, pantryMap, upsertPantry, deletePantry } from '../models/pantry.js';
import { normalizeName, pantryStatus } from '../lib/units.js';

const router = express.Router();

const DIFFICULTIES = ['Einfach', 'Mittel', 'Schwer'];

// Rohe Formulardaten in ein sauberes Datenobjekt überführen.
function normalizeRecipeBody(body) {
  let ingredients = body.ingredients;
  if (!ingredients) ingredients = [];
  else if (!Array.isArray(ingredients)) ingredients = Object.values(ingredients);

  let steps = body.steps;
  if (!steps) steps = [];
  else if (typeof steps === 'string') steps = [steps];
  else if (!Array.isArray(steps)) steps = Object.values(steps);

  const tags = String(body.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return { ...body, ingredients, steps, tags };
}

// --- Übersicht / Suche -----------------------------------------------------
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  const tagSlug = (req.query.tag || '').trim();

  let recipes;
  let activeTag = null;
  if (q) {
    recipes = searchRecipes(q);
  } else if (tagSlug) {
    activeTag = getTagBySlug(tagSlug) || null;
    recipes = listRecipes({ tagSlug });
  } else {
    recipes = listRecipes();
  }

  res.render('index', {
    title: q ? `Suche: ${q}` : 'Alle Rezepte',
    recipes,
    tags: allTagsWithCounts(),
    activeTag,
    query: q,
    isSearch: Boolean(q),
  });
});

// --- Neues Rezept ----------------------------------------------------------
router.get('/neu', (req, res) => {
  res.render('recipe-form', {
    title: 'Neues Rezept',
    mode: 'create',
    formAction: '/rezept',
    difficulties: DIFFICULTIES,
    recipe: {
      title: '', description: '', image_url: '', servings: 4,
      servings_unit: 'Portionen', prep_time: '', cook_time: '',
      difficulty: 'Mittel', notes: '',
      ingredients: [], steps: [], tags: [],
    },
  });
});

router.post('/rezept', (req, res) => {
  const slug = createRecipe(normalizeRecipeBody(req.body));
  res.redirect(`/rezept/${slug}`);
});

// --- Rezept bearbeiten -----------------------------------------------------
router.get('/rezept/:slug/bearbeiten', (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (!recipe) return res.status(404).render('404', { title: 'Nicht gefunden' });
  res.render('recipe-form', {
    title: `Bearbeiten: ${recipe.title}`,
    mode: 'edit',
    formAction: `/rezept/${recipe.slug}`,
    difficulties: DIFFICULTIES,
    recipe,
  });
});

router.post('/rezept/:slug', (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (!recipe) return res.status(404).render('404', { title: 'Nicht gefunden' });
  const slug = updateRecipe(recipe.id, normalizeRecipeBody(req.body));
  res.redirect(`/rezept/${slug}`);
});

router.post('/rezept/:slug/loeschen', (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (recipe) deleteRecipe(recipe.id);
  res.redirect('/');
});

// --- Rezept-Detailseite ----------------------------------------------------
router.get('/rezept/:slug', (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (!recipe) return res.status(404).render('404', { title: 'Nicht gefunden' });

  const pantry = pantryMap();
  // Anfangsstatus serverseitig berechnen (funktioniert auch ohne JavaScript);
  // das Skript rechnet beim Ändern der Portionen live nach.
  for (const ing of recipe.ingredients) {
    const have = pantry[normalizeName(ing.name)];
    const { status } = pantryStatus({ amount: ing.amount, unit: ing.unit }, have);
    ing.status = status;
  }

  res.render('recipe', {
    title: recipe.title,
    recipe,
    // sicher in ein <script>-Tag einbettbar
    pantryJson: JSON.stringify(pantry).replace(/</g, '\\u003c'),
  });
});

// --- Vorratskammer ---------------------------------------------------------
router.get('/vorrat', (req, res) => {
  res.render('pantry', {
    title: 'Vorratskammer',
    items: allPantry(),
  });
});

router.post('/vorrat', (req, res) => {
  upsertPantry({
    name: req.body.name,
    amount: req.body.amount,
    unit: req.body.unit,
  });
  res.redirect('/vorrat');
});

router.post('/vorrat/:id/loeschen', (req, res) => {
  deletePantry(req.params.id);
  res.redirect('/vorrat');
});

export default router;
