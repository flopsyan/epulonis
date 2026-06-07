// Beispiel-Daten: 3 Rezepte + ein gefüllter Vorrat.
// Wird beim ersten Start automatisch eingespielt (sofern SEED_DEMO != "false")
// und kann manuell per `npm run seed` (optional `-- --force`) erneut laufen.

import { getMeta, setMeta } from './db.js';
import { createRecipe, countRecipes } from './models/recipes.js';
import { upsertPantry } from './models/pantry.js';

const img = (id) =>
  `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

const RECIPES = [
  {
    title: 'Saftiger Zitronenkuchen',
    description:
      'Lockerer Rührkuchen mit frischer Zitrone und einem knackigen Zuckerguss – einfach gemacht und immer ein Hit zum Kaffee.',
    image_url: img('1519915028121-7d3463d20b13'),
    servings: 12,
    servings_unit: 'Stücke',
    prep_time: 25,
    cook_time: 45,
    difficulty: 'Einfach',
    tags: ['Kuchen', 'Dessert', 'Backen', 'Vegetarisch'],
    ingredients: [
      { amount: 250, unit: 'g', name: 'Mehl' },
      { amount: 200, unit: 'g', name: 'Zucker' },
      { amount: 200, unit: 'g', name: 'Butter', note: 'weich' },
      { amount: 4, unit: '', name: 'Eier' },
      { amount: 2, unit: '', name: 'Zitronen', note: 'Saft und Abrieb' },
      { amount: 1, unit: 'Päckchen', name: 'Backpulver' },
      { amount: 1, unit: 'Prise', name: 'Salz' },
      { amount: 100, unit: 'g', name: 'Puderzucker', note: 'für den Guss' },
    ],
    steps: [
      'Den Backofen auf 175 °C Ober-/Unterhitze vorheizen und eine Kastenform (ca. 25 cm) fetten und mit Mehl ausstäuben.',
      'Weiche Butter mit Zucker und einer Prise Salz schaumig rühren. Die Eier nacheinander unterrühren.',
      'Mehl mit Backpulver mischen und kurz unter den Teig rühren. Zitronenabrieb und die Hälfte des Zitronensafts zugeben.',
      'Den Teig in die Form füllen und glatt streichen. Auf mittlerer Schiene ca. 45 Minuten backen (Stäbchenprobe).',
      'Den Kuchen 10 Minuten in der Form ruhen lassen, dann stürzen und vollständig auskühlen lassen.',
      'Puderzucker mit dem restlichen Zitronensaft zu einem dickflüssigen Guss verrühren und über den ausgekühlten Kuchen geben.',
    ],
    notes:
      'Butter und Eier rund eine Stunde vor dem Backen aus dem Kühlschrank nehmen – mit Zutaten in Zimmertemperatur wird der Teig deutlich lockerer.',
  },
  {
    title: 'Spaghetti Carbonara',
    description:
      'Der römische Klassiker – cremig, würzig und ganz ohne Sahne. In rund 20 Minuten auf dem Tisch.',
    image_url: img('1612874742237-6526221588e3'),
    servings: 4,
    servings_unit: 'Portionen',
    prep_time: 10,
    cook_time: 15,
    difficulty: 'Mittel',
    tags: ['Pasta', 'Italienisch', 'Hauptgericht', 'Schnell'],
    ingredients: [
      { amount: 400, unit: 'g', name: 'Spaghetti' },
      { amount: 150, unit: 'g', name: 'Guanciale', note: 'alternativ Pancetta oder durchwachsener Speck' },
      { amount: 4, unit: '', name: 'Eigelb', note: 'Größe L' },
      { amount: 1, unit: '', name: 'Ei', note: 'ganzes Ei, Zimmertemperatur' },
      { amount: 50, unit: 'g', name: 'Pecorino Romano', note: 'fein gerieben' },
      { amount: 50, unit: 'g', name: 'Parmesan', note: 'fein gerieben' },
      { amount: null, unit: '', name: 'Salz', note: 'für das Nudelwasser' },
      { amount: null, unit: '', name: 'Pfeffer', note: 'frisch gemahlen, großzügig' },
    ],
    steps: [
      'Reichlich Salzwasser aufsetzen und die Spaghetti darin al dente garen.',
      'Guanciale in kleine Würfel schneiden und in einer Pfanne ohne Öl bei mittlerer Hitze knusprig auslassen.',
      'Eigelb und Ei mit dem geriebenen Pecorino und Parmesan sowie viel frischem Pfeffer glatt verrühren.',
      'Die abgetropften Spaghetti (etwas Nudelwasser aufheben) zum Guanciale geben und kurz schwenken. Die Pfanne vom Herd nehmen.',
      'Die Ei-Käse-Masse unterrühren, bei Bedarf mit etwas heißem Nudelwasser cremig rühren – nicht mehr kochen, sonst gerinnt das Ei.',
      'Sofort servieren und mit extra Pecorino und frischem Pfeffer bestreuen.',
    ],
    notes:
      'Die Pfanne unbedingt vom Herd nehmen, bevor die Eimasse dazukommt – die Restwärme reicht für die cremige Sauce. Zu viel Hitze macht Rührei daraus.',
  },
  {
    title: 'Ofen-Hähnchenbrust mit Cherrytomaten',
    description:
      'Saftige Hähnchenbrust aus dem Ofen auf Kartoffeln und Cherrytomaten – ein unkompliziertes Blechgericht für die ganze Familie.',
    image_url: img('1604908176997-125f25cc6f3d'),
    servings: 4,
    servings_unit: 'Portionen',
    prep_time: 20,
    cook_time: 35,
    difficulty: 'Mittel',
    tags: ['Hauptgericht', 'Fleisch', 'Ofen'],
    ingredients: [
      { amount: 600, unit: 'g', name: 'Hähnchenbrust' },
      { amount: 500, unit: 'g', name: 'Kartoffeln', note: 'festkochend, in Spalten' },
      { amount: 200, unit: 'g', name: 'Cherrytomaten' },
      { amount: 1, unit: '', name: 'Zitrone', note: 'in Spalten, zum Beträufeln' },
      { amount: 2, unit: 'Zehen', name: 'Knoblauch' },
      { amount: 3, unit: 'EL', name: 'Olivenöl' },
      { amount: 1, unit: 'TL', name: 'Paprikapulver', note: 'edelsüß' },
      { amount: 1, unit: 'TL', name: 'Thymian', note: 'getrocknet' },
      { amount: null, unit: '', name: 'Salz' },
      { amount: null, unit: '', name: 'Pfeffer' },
    ],
    steps: [
      'Den Backofen auf 200 °C Ober-/Unterhitze vorheizen.',
      'Kartoffeln waschen, in Spalten schneiden, mit 2 EL Olivenöl, Salz und Pfeffer vermengen, auf einem Backblech verteilen und 10 Minuten vorbacken.',
      'Hähnchenbrust mit dem restlichen Öl, gepresstem Knoblauch, Paprikapulver, Thymian, Salz und Pfeffer einreiben.',
      'Hähnchen und Cherrytomaten zu den Kartoffeln aufs Blech geben.',
      'Alles zusammen ca. 25–30 Minuten backen, bis das Hähnchen durchgegart und die Kartoffeln goldbraun sind.',
      'Vor dem Servieren kurz ruhen lassen, mit Zitrone beträufeln und nach Geschmack mit frischen Kräutern bestreuen.',
    ],
    notes:
      'Die Hähnchenbrust am Vortag mit Öl, Knoblauch und den Gewürzen einreiben und abgedeckt in den Kühlschrank legen. So zieht die Marinade über Nacht durch und das Fleisch wird besonders aromatisch und zart.',
  },
];

const PANTRY = [
  { name: 'Mehl', amount: 1000, unit: 'g' },
  { name: 'Zucker', amount: 500, unit: 'g' },
  { name: 'Butter', amount: 250, unit: 'g' },
  { name: 'Eier', amount: 6, unit: 'Stück' },
  { name: 'Spaghetti', amount: 250, unit: 'g' },
  { name: 'Zitronen', amount: 3, unit: 'Stück' },
  { name: 'Salz', amount: 500, unit: 'g' },
  { name: 'Pfeffer', amount: 50, unit: 'g' },
  { name: 'Olivenöl', amount: 500, unit: 'ml' },
  { name: 'Kartoffeln', amount: 1000, unit: 'g' },
  { name: 'Knoblauch', amount: 6, unit: 'Zehen' },
  { name: 'Parmesan', amount: 100, unit: 'g' },
  { name: 'Backpulver', amount: 2, unit: 'Päckchen' },
  { name: 'Cherrytomaten', amount: 100, unit: 'g' },
];

export function seedDemo({ force = false } = {}) {
  if (!force && getMeta('demo_seeded')) return false;
  if (!force && countRecipes() > 0) {
    setMeta('demo_seeded', '1');
    return false;
  }
  for (const recipe of RECIPES) createRecipe(recipe);
  for (const item of PANTRY) upsertPantry(item);
  setMeta('demo_seeded', '1');
  return true;
}

// Direkter Aufruf: node src/seed.js [--force]
if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force');
  const seeded = seedDemo({ force });
  console.log(
    seeded
      ? `✓ Beispieldaten eingespielt: ${RECIPES.length} Rezepte, ${PANTRY.length} Vorratsartikel.`
      : 'ℹ Beispieldaten wurden übersprungen (bereits vorhanden). Mit "--force" erzwingen.'
  );
  process.exit(0);
}
