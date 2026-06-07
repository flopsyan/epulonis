// Example data: 3 recipes + a stocked pantry.
// Seeded automatically on the very first start (unless SEED_DEMO is "false")
// and can be run manually via `npm run seed` (optionally `-- --force`).

import { getMeta, setMeta } from './db.js';
import { createRecipe, countRecipes } from './models/recipes.js';
import { upsertPantry } from './models/pantry.js';
import { listUsers } from './models/users.js';

const img = (id) =>
  `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

const RECIPES = [
  {
    title: 'Moist Lemon Cake',
    description:
      'A light, fluffy loaf cake with fresh lemon and a crisp sugar glaze – easy to make and always a hit with coffee.',
    image_url: img('1519915028121-7d3463d20b13'),
    servings: 12,
    servings_unit: 'Slices',
    prep_time: 25,
    cook_time: 45,
    difficulty: 'Easy',
    tags: ['Cake', 'Dessert', 'Baking', 'Vegetarian'],
    ingredients: [
      { amount: 250, unit: 'g', name: 'Flour' },
      { amount: 200, unit: 'g', name: 'Sugar' },
      { amount: 200, unit: 'g', name: 'Butter', note: 'soft' },
      { amount: 4, unit: '', name: 'Eggs' },
      { amount: 2, unit: '', name: 'Lemons', note: 'juice and zest' },
      { amount: 1, unit: 'packet', name: 'Baking powder' },
      { amount: 1, unit: 'pinch', name: 'Salt' },
      { amount: 100, unit: 'g', name: 'Powdered sugar', note: 'for the glaze' },
    ],
    steps: [
      'Preheat the oven to 175 °C (top/bottom heat) and grease a loaf tin (approx. 25 cm) and dust it with flour.',
      'Beat the soft butter with the sugar and a pinch of salt until fluffy. Stir in the eggs one at a time.',
      'Mix the flour with the baking powder and briefly fold it into the batter. Add the lemon zest and half of the lemon juice.',
      'Pour the batter into the tin, smooth the top and bake on the middle rack for about 45 minutes (test with a skewer).',
      'Let the cake rest in the tin for 10 minutes, then turn it out and let it cool completely.',
      'Mix the powdered sugar with the remaining lemon juice into a thick glaze and pour it over the cooled cake.',
    ],
    notes:
      'Take the butter and eggs out of the fridge about an hour before baking – with room-temperature ingredients the batter turns out much fluffier.',
  },
  {
    title: 'Spaghetti Carbonara',
    description:
      'The Roman classic – creamy, savoury and completely without cream. On the table in about 20 minutes.',
    image_url: img('1612874742237-6526221588e3'),
    servings: 4,
    servings_unit: 'Servings',
    prep_time: 10,
    cook_time: 15,
    difficulty: 'Medium',
    tags: ['Pasta', 'Italian', 'Main course', 'Quick'],
    ingredients: [
      { amount: 400, unit: 'g', name: 'Spaghetti' },
      { amount: 150, unit: 'g', name: 'Guanciale', note: 'or pancetta / streaky bacon' },
      { amount: 4, unit: '', name: 'Egg yolks', note: 'size L' },
      { amount: 1, unit: '', name: 'Egg', note: 'whole, room temperature' },
      { amount: 50, unit: 'g', name: 'Pecorino Romano', note: 'finely grated' },
      { amount: 50, unit: 'g', name: 'Parmesan', note: 'finely grated' },
      { amount: null, unit: '', name: 'Salt', note: 'for the pasta water' },
      { amount: null, unit: '', name: 'Pepper', note: 'freshly ground, generous' },
    ],
    steps: [
      'Bring plenty of salted water to the boil and cook the spaghetti until al dente.',
      'Cut the guanciale into small cubes and render it until crisp in a pan without oil over medium heat.',
      'Whisk the egg yolks and egg with the grated pecorino and parmesan and plenty of fresh pepper until smooth.',
      'Add the drained spaghetti (reserve some pasta water) to the guanciale and toss briefly. Take the pan off the heat.',
      'Stir in the egg-and-cheese mixture, loosening with a little hot pasta water until creamy – do not cook it further or the egg will scramble.',
      'Serve immediately and sprinkle with extra pecorino and fresh pepper.',
    ],
    notes:
      'Be sure to take the pan off the heat before adding the egg mixture – the residual heat is enough for the creamy sauce. Too much heat turns it into scrambled eggs.',
  },
  {
    title: 'Oven-Baked Chicken Breast with Cherry Tomatoes',
    description:
      'Juicy chicken breast from the oven on a bed of potatoes and cherry tomatoes – an easy sheet-pan meal for the whole family.',
    image_url: img('1604908176997-125f25cc6f3d'),
    servings: 4,
    servings_unit: 'Servings',
    prep_time: 20,
    cook_time: 35,
    difficulty: 'Medium',
    tags: ['Main course', 'Meat', 'Oven'],
    ingredients: [
      { amount: 600, unit: 'g', name: 'Chicken breast' },
      { amount: 500, unit: 'g', name: 'Potatoes', note: 'waxy, in wedges' },
      { amount: 200, unit: 'g', name: 'Cherry tomatoes' },
      { amount: 1, unit: '', name: 'Lemon', note: 'in wedges, for drizzling' },
      { amount: 2, unit: 'cloves', name: 'Garlic' },
      { amount: 3, unit: 'tbsp', name: 'Olive oil' },
      { amount: 1, unit: 'tsp', name: 'Paprika', note: 'sweet' },
      { amount: 1, unit: 'tsp', name: 'Thyme', note: 'dried' },
      { amount: null, unit: '', name: 'Salt' },
      { amount: null, unit: '', name: 'Pepper' },
    ],
    steps: [
      'Preheat the oven to 200 °C (top/bottom heat).',
      'Wash the potatoes, cut them into wedges, toss with 2 tbsp olive oil, salt and pepper, spread on a baking tray and pre-bake for 10 minutes.',
      'Rub the chicken breast with the remaining oil, crushed garlic, paprika, thyme, salt and pepper.',
      'Add the chicken and cherry tomatoes to the potatoes on the tray.',
      'Bake everything together for about 25–30 minutes until the chicken is cooked through and the potatoes are golden.',
      'Let it rest briefly before serving, drizzle with lemon and sprinkle with fresh herbs to taste.',
    ],
    notes:
      'Rub the chicken breast the day before with oil, garlic and the spices and leave it covered in the fridge. That way the marinade soaks in overnight and the meat becomes especially flavourful and tender.',
  },
];

const PANTRY = [
  { name: 'Flour', amount: 1000, unit: 'g' },
  { name: 'Sugar', amount: 500, unit: 'g' },
  { name: 'Butter', amount: 250, unit: 'g' },
  { name: 'Eggs', amount: 6, unit: '' },
  { name: 'Spaghetti', amount: 250, unit: 'g' },
  { name: 'Lemons', amount: 3, unit: '' },
  { name: 'Salt', amount: 500, unit: 'g' },
  { name: 'Pepper', amount: 50, unit: 'g' },
  { name: 'Olive oil', amount: 500, unit: 'ml' },
  { name: 'Potatoes', amount: 1000, unit: 'g' },
  { name: 'Garlic', amount: 6, unit: 'cloves' },
  { name: 'Parmesan', amount: 100, unit: 'g' },
  { name: 'Baking powder', amount: 2, unit: 'packet' },
  { name: 'Cherry tomatoes', amount: 100, unit: 'g' },
];

export function seedDemo({ force = false } = {}) {
  if (!force && getMeta('demo_seeded')) return false;
  if (!force && countRecipes() > 0) {
    setMeta('demo_seeded', '1');
    return false;
  }
  // Attribute demo recipes to the first account (the bootstrapped admin), if any.
  const admin = listUsers()[0] ?? null;
  for (const recipe of RECIPES)
    createRecipe({
      ...recipe,
      author_id: admin?.id ?? null,
      author_name: admin ? admin.display_name || admin.username : '',
    });
  for (const item of PANTRY) upsertPantry(item);
  setMeta('demo_seeded', '1');
  return true;
}

// Direct invocation: node src/seed.js [--force]
if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force');
  const seeded = seedDemo({ force });
  console.log(
    seeded
      ? `✓ Demo data seeded: ${RECIPES.length} recipes, ${PANTRY.length} pantry items.`
      : 'ℹ Demo data skipped (already present). Use "--force" to override.'
  );
  process.exit(0);
}
