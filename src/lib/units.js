// Unit logic: normalization, conversion and quantity comparison.
// Used for the pantry match on the server and mirrored in the browser
// (public/js/units.js). Keep both files in sync on purpose.

// Synonyms -> canonical unit
const SYNONYMS = {
  // mass
  mg: 'mg', milligram: 'mg', milligrams: 'mg',
  g: 'g', gr: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  dag: 'dag',
  kg: 'kg', kilo: 'kg', kilogram: 'kg', kilograms: 'kg',
  // volume
  ml: 'ml', milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml',
  cl: 'cl',
  dl: 'dl',
  l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l', ltr: 'l',
  // count
  '': 'pcs', pc: 'pcs', pcs: 'pcs', piece: 'pcs', pieces: 'pcs', x: 'pcs',
};

// Conversion factors to the respective base unit
const MASS = { mg: 0.001, g: 1, dag: 10, kg: 1000 }; // base: g
const VOLUME = { ml: 1, cl: 10, dl: 100, l: 1000 }; // base: ml

export function normalizeUnit(unit) {
  let u = String(unit ?? '').trim().toLowerCase();
  u = u.replace(/\.+$/, ''); // "tbsp." -> "tbsp"
  if (Object.prototype.hasOwnProperty.call(SYNONYMS, u)) return SYNONYMS[u];
  return u;
}

// Returns { dimension, value } in base units.
// dimension is 'mass' | 'volume' | 'count' | 'other:<unit>'.
// Two quantities are only comparable if their dimension is identical.
export function toBase(amount, unit) {
  const u = normalizeUnit(unit);
  const value = amount == null || amount === '' ? null : Number(amount);
  if (u in MASS) return { dimension: 'mass', value: value == null ? null : value * MASS[u] };
  if (u in VOLUME) return { dimension: 'volume', value: value == null ? null : value * VOLUME[u] };
  if (u === 'pcs') return { dimension: 'count', value };
  return { dimension: `other:${u}`, value };
}

// Inverse of toBase: convert a value in base units back into `unit`.
export function baseToUnit(baseValue, unit) {
  const u = normalizeUnit(unit);
  if (u in MASS) return baseValue / MASS[u];
  if (u in VOLUME) return baseValue / VOLUME[u];
  return baseValue; // count / other units are stored 1:1
}

// Subtracts a needed amount from a pantry entry and returns the remaining
// amount expressed in the pantry entry's own unit (never below 0). Returns null
// when the subtraction is not possible (no/zero amount, incomparable units, or
// the pantry entry has no amount to subtract from).
export function consumeAmount(have, need) {
  const needBase = toBase(need.amount, need.unit);
  const haveBase = toBase(have.amount, have.unit);
  if (needBase.value == null || needBase.value <= 0) return null;
  if (haveBase.value == null || needBase.dimension !== haveBase.dimension) return null;
  let remaining = baseToUnit(haveBase.value - needBase.value, have.unit);
  if (remaining < 0) remaining = 0;
  return Math.round(remaining * 1000) / 1000;
}

// Normalizes ingredient/pantry names for matching and unifies simple English
// plurals (egg/eggs, lemon/lemons, tomato/tomatoes, berry/berries) so that
// e.g. "1 lemon" in a recipe matches "Lemons" in the pantry.
export function normalizeName(name) {
  let n = String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (n.length > 4 && n.endsWith('ies')) return n.slice(0, -3) + 'y'; // berries -> berry
  if (n.length > 4 && n.endsWith('oes')) return n.slice(0, -2); // tomatoes -> tomato
  if (n.length > 3 && n.endsWith('s') && !n.endsWith('ss')) return n.slice(0, -1); // eggs -> egg
  return n;
}

// Compares a needed ingredient with a pantry entry.
// Returned status:
//   'ok'        - enough in stock
//   'low'       - some in stock, but not enough
//   'missing'   - not in the pantry
//   'unknown'   - in the pantry, but quantities not comparable (different unit)
//   'available' - in the pantry, ingredient without a quantity
export function pantryStatus(need, have) {
  if (!have) return { status: 'missing', haveBase: 0 };

  const needBase = toBase(need.amount, need.unit);
  const haveBase = toBase(have.amount, have.unit);

  // Ingredient without a quantity (e.g. "salt to taste")
  if (needBase.value == null) {
    return { status: 'available', haveBase: haveBase.value };
  }

  // Units not comparable -> we only know: it's in stock
  if (needBase.dimension !== haveBase.dimension || haveBase.value == null) {
    return { status: 'unknown', haveBase: haveBase.value };
  }

  if (haveBase.value >= needBase.value) return { status: 'ok', haveBase: haveBase.value };
  if (haveBase.value > 0) return { status: 'low', haveBase: haveBase.value };
  return { status: 'missing', haveBase: haveBase.value };
}
