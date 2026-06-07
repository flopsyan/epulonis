// Browser mirror of src/lib/units.js (+ formatAmount).
// Used for the live pantry match on the recipe page.

const SYNONYMS = {
  mg: 'mg', milligram: 'mg', milligrams: 'mg',
  g: 'g', gr: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  dag: 'dag',
  kg: 'kg', kilo: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml',
  cl: 'cl',
  dl: 'dl',
  l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l', ltr: 'l',
  '': 'pcs', pc: 'pcs', pcs: 'pcs', piece: 'pcs', pieces: 'pcs', x: 'pcs',
};

const MASS = { mg: 0.001, g: 1, dag: 10, kg: 1000 };
const VOLUME = { ml: 1, cl: 10, dl: 100, l: 1000 };

export function normalizeUnit(unit) {
  let u = String(unit ?? '').trim().toLowerCase().replace(/\.+$/, '');
  return Object.prototype.hasOwnProperty.call(SYNONYMS, u) ? SYNONYMS[u] : u;
}

export function toBase(amount, unit) {
  const u = normalizeUnit(unit);
  const value = amount == null || amount === '' ? null : Number(amount);
  if (u in MASS) return { dimension: 'mass', value: value == null ? null : value * MASS[u] };
  if (u in VOLUME) return { dimension: 'volume', value: value == null ? null : value * VOLUME[u] };
  if (u === 'pcs') return { dimension: 'count', value };
  return { dimension: `other:${u}`, value };
}

export function normalizeName(name) {
  let n = String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (n.length > 4 && n.endsWith('ies')) return n.slice(0, -3) + 'y';
  if (n.length > 4 && n.endsWith('oes')) return n.slice(0, -2);
  if (n.length > 3 && n.endsWith('s') && !n.endsWith('ss')) return n.slice(0, -1);
  return n;
}

export function pantryStatus(need, have) {
  if (!have) return 'missing';
  const needBase = toBase(need.amount, need.unit);
  const haveBase = toBase(have.amount, have.unit);
  if (needBase.value == null) return 'available';
  if (needBase.dimension !== haveBase.dimension || haveBase.value == null) return 'unknown';
  if (haveBase.value >= needBase.value) return 'ok';
  if (haveBase.value > 0) return 'low';
  return 'missing';
}

export function formatAmount(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '';
  const rounded = Math.round(Number(value) * 100) / 100;
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
