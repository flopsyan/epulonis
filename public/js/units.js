// Browser-Spiegel von src/lib/units.js (+ formatAmount).
// Wird für den Live-Vorratsabgleich auf der Rezeptseite genutzt.

const SYNONYMS = {
  mg: 'mg', milligramm: 'mg',
  g: 'g', gr: 'g', gramm: 'g', gramms: 'g',
  dag: 'dag', dkg: 'dag', deka: 'dag', dekagramm: 'dag',
  kg: 'kg', kilo: 'kg', kilogramm: 'kg',
  ml: 'ml', milliliter: 'ml',
  cl: 'cl', centiliter: 'cl', zentiliter: 'cl',
  dl: 'dl', deziliter: 'dl',
  l: 'l', liter: 'l', ltr: 'l',
  '': 'stück', stk: 'stück', st: 'stück', stck: 'stück', stueck: 'stück',
  'stück': 'stück', 'stücke': 'stück', x: 'stück',
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
  if (u === 'stück') return { dimension: 'count', value };
  return { dimension: `other:${u}`, value };
}

const IRREGULAR_PLURALS = { eier: 'ei' };

export function normalizeName(name) {
  let n = String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (IRREGULAR_PLURALS[n]) return IRREGULAR_PLURALS[n];
  if (n.length > 3 && n.endsWith('n')) n = n.slice(0, -1);
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
  return rounded.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}
