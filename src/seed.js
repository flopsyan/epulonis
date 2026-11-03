// Example data: 3 recipes + a stocked pantry.
// Seeded automatically on the very first start (unless SEED_DEMO is "false")
// and can be run manually via `npm run seed` (optionally `-- --force`).

import { getMeta, setMeta } from './db.js';
import { createRecipe, countRecipes } from './models/recipes.js';
import { addPantry } from './models/pantry.js';
import { listUsers } from './models/users.js';

const img = (id) =>
  `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

const RECIPES = [
  {
    title: 'Saftiger Zitronenkuchen',
    description:
      'Ein leichter, fluffiger Kastenkuchen mit frischer Zitrone und knackiger Zuckerglasur - schnell gemacht und zum Kaffee immer ein Erfolg.',
    image_url: img('1519915028121-7d3463d20b13'),
    servings: 12,
    servings_unit: 'Stücke',
    prep_time: 25,
    cook_time: 45,
    rest_time: 15,
    difficulty: 'Easy',
    tags: ['Kuchen', 'Dessert', 'Backen', 'Vegetarisch'],
    ingredients: [
      { amount: 250, unit: 'g', name: 'Mehl' },
      { amount: 200, unit: 'g', name: 'Zucker' },
      { amount: 200, unit: 'g', name: 'Butter', note: 'weich' },
      { amount: 4, unit: '', name: 'Eier' },
      { amount: 2, unit: '', name: 'Zitronen', note: 'Saft und Abrieb' },
      { amount: 1, unit: 'Pck.', name: 'Backpulver' },
      { amount: 1, unit: 'Prise', name: 'Salz' },
      { amount: 100, unit: 'g', name: 'Puderzucker', note: 'für die Glasur' },
    ],
    steps: [
      'Den Ofen auf 175 °C (Ober-/Unterhitze) vorheizen, eine Kastenform (ca. 25 cm) einfetten und mit Mehl bestäuben.',
      'Die weiche Butter mit dem Zucker und einer Prise Salz schaumig schlagen. Die Eier einzeln unterrühren.',
      'Mehl und Backpulver mischen und kurz unter den Teig heben. Zitronenabrieb und die Hälfte des Zitronensafts dazugeben.',
      'Den Teig in die Form füllen, glatt streichen und auf mittlerer Schiene etwa 45 Minuten backen (Stäbchenprobe).',
      'Den Kuchen 10 Minuten in der Form ruhen lassen, dann stürzen und vollständig auskühlen lassen.',
      'Puderzucker mit dem restlichen Zitronensaft zu einer dicken Glasur verrühren und über den abgekühlten Kuchen gießen.',
    ],
    notes:
      'Butter und Eier etwa eine Stunde vor dem Backen aus dem Kühlschrank nehmen - mit zimmerwarmen Zutaten wird der Teig deutlich fluffiger.',
  },
  {
    title: 'Spaghetti Carbonara',
    description:
      'Der römische Klassiker - cremig, würzig und ganz ohne Sahne. In etwa 20 Minuten auf dem Tisch.',
    image_url: img('1612874742237-6526221588e3'),
    servings: 4,
    servings_unit: 'Portionen',
    prep_time: 10,
    cook_time: 15,
    rest_time: 0,
    difficulty: 'Medium',
    tags: ['Pasta', 'Italienisch', 'Hauptgericht', 'Schnell'],
    ingredients: [
      { amount: 400, unit: 'g', name: 'Spaghetti' },
      { amount: 150, unit: 'g', name: 'Guanciale', note: 'oder Pancetta / durchwachsener Speck' },
      { amount: 4, unit: '', name: 'Eigelb', note: 'Größe L' },
      { amount: 1, unit: '', name: 'Ei', note: 'ganz, zimmerwarm' },
      { amount: 50, unit: 'g', name: 'Pecorino Romano', note: 'fein gerieben' },
      { amount: 50, unit: 'g', name: 'Parmesan', note: 'fein gerieben' },
      { amount: null, unit: '', name: 'Salz', note: 'für das Nudelwasser' },
      { amount: null, unit: '', name: 'Pfeffer', note: 'frisch gemahlen, großzügig' },
    ],
    steps: [
      'Reichlich Salzwasser aufkochen und die Spaghetti darin al dente kochen.',
      'Den Guanciale in kleine Würfel schneiden und in einer Pfanne ohne Öl bei mittlerer Hitze knusprig auslassen.',
      'Eigelb und Ei mit dem geriebenen Pecorino, dem Parmesan und reichlich frischem Pfeffer glatt verquirlen.',
      'Die abgetropften Spaghetti (etwas Nudelwasser auffangen) zum Guanciale geben und kurz durchschwenken. Die Pfanne vom Herd nehmen.',
      'Die Ei-Käse-Mischung unterrühren und mit etwas heißem Nudelwasser cremig lösen - nicht weiter erhitzen, sonst stockt das Ei.',
      'Sofort servieren und mit extra Pecorino und frischem Pfeffer bestreuen.',
    ],
    notes:
      'Die Pfanne unbedingt vom Herd nehmen, bevor die Eimischung dazukommt - die Restwärme reicht für die cremige Sauce. Zu viel Hitze macht daraus Rührei.',
  },
  {
    title: 'Hähnchenbrust aus dem Ofen mit Kirschtomaten',
    description:
      'Saftige Hähnchenbrust aus dem Ofen auf Kartoffeln und Kirschtomaten - ein einfaches Blechgericht für die ganze Familie.',
    image_url: img('1604908176997-125f25cc6f3d'),
    servings: 4,
    servings_unit: 'Portionen',
    prep_time: 20,
    cook_time: 35,
    rest_time: 5,
    difficulty: 'Medium',
    tags: ['Hauptgericht', 'Fleisch', 'Ofen'],
    ingredients: [
      { amount: 600, unit: 'g', name: 'Hähnchenbrust' },
      { amount: 500, unit: 'g', name: 'Kartoffeln', note: 'festkochend, in Spalten' },
      { amount: 200, unit: 'g', name: 'Kirschtomaten' },
      { amount: 1, unit: '', name: 'Zitrone', note: 'in Spalten, zum Beträufeln' },
      { amount: 2, unit: 'Zehen', name: 'Knoblauch' },
      { amount: 3, unit: 'EL', name: 'Olivenöl' },
      { amount: 1, unit: 'TL', name: 'Paprikapulver', note: 'edelsüß' },
      { amount: 1, unit: 'TL', name: 'Thymian', note: 'getrocknet' },
      { amount: null, unit: '', name: 'Salz' },
      { amount: null, unit: '', name: 'Pfeffer' },
    ],
    steps: [
      'Den Ofen auf 200 °C (Ober-/Unterhitze) vorheizen.',
      'Die Kartoffeln waschen, in Spalten schneiden, mit 2 EL Olivenöl, Salz und Pfeffer mischen, auf einem Blech verteilen und 10 Minuten vorbacken.',
      'Die Hähnchenbrust mit dem restlichen Öl, zerdrücktem Knoblauch, Paprika, Thymian, Salz und Pfeffer einreiben.',
      'Hähnchen und Kirschtomaten zu den Kartoffeln aufs Blech geben.',
      'Alles zusammen etwa 25-30 Minuten backen, bis das Hähnchen durchgegart ist und die Kartoffeln goldbraun sind.',
      'Vor dem Servieren kurz ruhen lassen, mit Zitrone beträufeln und nach Belieben mit frischen Kräutern bestreuen.',
    ],
    notes:
      'Die Hähnchenbrust schon am Vortag mit Öl, Knoblauch und den Gewürzen einreiben und abgedeckt in den Kühlschrank stellen. So zieht die Marinade über Nacht ein und das Fleisch wird besonders aromatisch und zart.',
  },
];

const PANTRY = [
  { name: 'Mehl', amount: 1000, unit: 'g' },
  { name: 'Zucker', amount: 500, unit: 'g' },
  { name: 'Butter', amount: 250, unit: 'g' },
  { name: 'Eier', amount: 6, unit: 'Stk.' },
  { name: 'Spaghetti', amount: 250, unit: 'g' },
  { name: 'Zitronen', amount: 3, unit: 'Stk.' },
  { name: 'Salz', amount: 500, unit: 'g' },
  { name: 'Pfeffer', amount: 50, unit: 'g' },
  { name: 'Olivenöl', amount: 500, unit: 'ml' },
  { name: 'Kartoffeln', amount: 1000, unit: 'g' },
  { name: 'Knoblauch', amount: 6, unit: 'Zehen' },
  { name: 'Parmesan', amount: 100, unit: 'g' },
  { name: 'Backpulver', amount: 2, unit: 'Pck.' },
  { name: 'Kirschtomaten', amount: 100, unit: 'g' },
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
  for (const item of PANTRY) addPantry(item);
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
