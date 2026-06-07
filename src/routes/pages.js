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

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

// Turns raw form data into a clean data object.
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

// --- Overview / search -----------------------------------------------------
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
    title: q ? `Search: ${q}` : 'All recipes',
    recipes,
    tags: allTagsWithCounts(),
    activeTag,
    query: q,
    isSearch: Boolean(q),
  });
});

// --- New recipe ------------------------------------------------------------
router.get('/new', (req, res) => {
  res.render('recipe-form', {
    title: 'New recipe',
    mode: 'create',
    formAction: '/recipe',
    difficulties: DIFFICULTIES,
    recipe: {
      title: '', description: '', image_url: '', servings: 4,
      servings_unit: 'Servings', prep_time: '', cook_time: '',
      difficulty: 'Medium', notes: '',
      ingredients: [], steps: [], tags: [],
    },
  });
});

router.post('/recipe', (req, res) => {
  const slug = createRecipe(normalizeRecipeBody(req.body));
  res.redirect(`/recipe/${slug}`);
});

// --- Edit recipe -----------------------------------------------------------
router.get('/recipe/:slug/edit', (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (!recipe) return res.status(404).render('404', { title: 'Not found' });
  res.render('recipe-form', {
    title: `Edit: ${recipe.title}`,
    mode: 'edit',
    formAction: `/recipe/${recipe.slug}`,
    difficulties: DIFFICULTIES,
    recipe,
  });
});

router.post('/recipe/:slug', (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (!recipe) return res.status(404).render('404', { title: 'Not found' });
  const slug = updateRecipe(recipe.id, normalizeRecipeBody(req.body));
  res.redirect(`/recipe/${slug}`);
});

router.post('/recipe/:slug/delete', (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (recipe) deleteRecipe(recipe.id);
  res.redirect('/');
});

// --- Recipe detail page ----------------------------------------------------
router.get('/recipe/:slug', (req, res) => {
  const recipe = getRecipeBySlug(req.params.slug);
  if (!recipe) return res.status(404).render('404', { title: 'Not found' });

  const pantry = pantryMap();
  // Compute the initial status on the server (works without JavaScript too);
  // the script recomputes live when the servings change.
  for (const ing of recipe.ingredients) {
    const have = pantry[normalizeName(ing.name)];
    const { status } = pantryStatus({ amount: ing.amount, unit: ing.unit }, have);
    ing.status = status;
  }

  res.render('recipe', {
    title: recipe.title,
    recipe,
    // safe to embed inside a <script> tag
    pantryJson: JSON.stringify(pantry).replace(/</g, '\\u003c'),
  });
});

// --- Pantry ----------------------------------------------------------------
router.get('/pantry', (req, res) => {
  res.render('pantry', {
    title: 'Pantry',
    items: allPantry(),
  });
});

router.post('/pantry', (req, res) => {
  upsertPantry({
    name: req.body.name,
    amount: req.body.amount,
    unit: req.body.unit,
  });
  res.redirect('/pantry');
});

router.post('/pantry/:id/delete', (req, res) => {
  deletePantry(req.params.id);
  res.redirect('/pantry');
});

export default router;
